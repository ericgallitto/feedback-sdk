import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createApp } from '../src/app.js'
import { createMemoryStore } from '../src/memory-store.js'
import { signWebhook } from '../src/webhooks.js'
import { createHmac } from 'node:crypto'

const PUBLISHABLE = 'pub_test_key'
const SECRET = 'sec_test_key'
const WEBHOOK_SECRET = 'whsec_test'

function makeApp(overrides?: { webhooks?: Array<{ url: string; secret: string }> }) {
  return createApp({
    store: createMemoryStore(),
    publishableKey: PUBLISHABLE,
    secretKey: SECRET,
    webhooks: overrides?.webhooks ?? [],
  })
}

const validBody = {
  page_url: 'https://app.example.com/home',
  category: 'bug',
  comment: 'Something is broken.',
  user_email: 'test@example.com',
}

// ─── Health ──────────────────────────────────────────────────────────────────

describe('GET /healthz', () => {
  it('returns 200 ok', async () => {
    const app = makeApp()
    const res = await app.request('/healthz')
    expect(res.status).toBe(200)
    const body = await res.json() as { ok: boolean }
    expect(body.ok).toBe(true)
  })
})

// ─── Submit ──────────────────────────────────────────────────────────────────

describe('POST /feedback', () => {
  it('returns 201 with the created record on a valid payload', async () => {
    const app = makeApp()
    const res = await app.request('/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Feedback-Key': PUBLISHABLE },
      body: JSON.stringify(validBody),
    })
    expect(res.status).toBe(201)
    const record = await res.json() as Record<string, unknown>
    expect(typeof record['id']).toBe('string')
    expect(record['status']).toBe('new')
    expect(record['pipeline_state']).toBe('captured')
    expect(record['category']).toBe('bug')
  })

  it('returns 400 when page_url is missing', async () => {
    const app = makeApp()
    const res = await app.request('/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Feedback-Key': PUBLISHABLE },
      body: JSON.stringify({ category: 'bug', comment: 'oops', user_email: 'x@x.com' }),
    })
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toMatch(/page_url/)
  })

  it('returns 400 when comment is empty', async () => {
    const app = makeApp()
    const res = await app.request('/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Feedback-Key': PUBLISHABLE },
      body: JSON.stringify({ ...validBody, comment: '' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 when category is invalid', async () => {
    const app = makeApp()
    const res = await app.request('/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Feedback-Key': PUBLISHABLE },
      body: JSON.stringify({ ...validBody, category: 'complaint' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 when neither user_id nor user_email is provided', async () => {
    const app = makeApp()
    const { user_email: _e, ...noIdentity } = validBody
    const res = await app.request('/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Feedback-Key': PUBLISHABLE },
      body: JSON.stringify(noIdentity),
    })
    expect(res.status).toBe(400)
  })

  it('returns 401 when publishable key is wrong', async () => {
    const app = makeApp()
    const res = await app.request('/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Feedback-Key': 'wrong' },
      body: JSON.stringify(validBody),
    })
    expect(res.status).toBe(401)
  })

  it('bypasses auth check in demoMode', async () => {
    const app = createApp({ store: createMemoryStore(), demoMode: true })
    const res = await app.request('/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    expect(res.status).toBe(201)
  })
})

// ─── Webhook delivery ─────────────────────────────────────────────────────────

describe('POST /feedback webhook delivery', () => {
  it('fires a signed feedback.created webhook on submit', async () => {
    const received: Array<{ sig: string; body: string }> = []

    // stub fetch so webhook POST is intercepted
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      if (typeof url === 'string' && url.includes('webhook')) {
        received.push({
          sig: (init?.headers as Record<string, string>)['X-Feedback-Signature'] ?? '',
          body: typeof init?.body === 'string' ? init.body : '',
        })
      }
      return new Response(null, { status: 200 })
    })

    const app = createApp({
      store: createMemoryStore(),
      demoMode: true,
      webhooks: [{ url: 'https://example.com/webhook', secret: WEBHOOK_SECRET }],
    })

    await app.request('/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    })

    // give the fire-and-forget promise a tick to resolve
    await new Promise((r) => setTimeout(r, 10))

    expect(received.length).toBe(1)

    // verify the HMAC-SHA256 signature
    const { sig, body } = received[0]
    const match = sig.match(/^t=(\d+),v1=([a-f0-9]+)$/)
    expect(match).not.toBeNull()
    const [, ts, v1] = match!
    const expected = createHmac('sha256', WEBHOOK_SECRET)
      .update(`${ts}.${body}`)
      .digest('hex')
    expect(v1).toBe(expected)

    // event shape
    const event = JSON.parse(body) as { event: string; data: Record<string, unknown> }
    expect(event.event).toBe('feedback.created')
    expect(event.data['status']).toBe('new')

    vi.restoreAllMocks()
  })
})

// ─── List / Get / Update ─────────────────────────────────────────────────────

describe('GET /feedback', () => {
  it('returns 401 without secret key', async () => {
    const app = makeApp()
    const res = await app.request('/feedback', {
      headers: { Authorization: 'Bearer wrong' },
    })
    expect(res.status).toBe(401)
  })

  it('returns the submitted record', async () => {
    const app = makeApp()
    await app.request('/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Feedback-Key': PUBLISHABLE },
      body: JSON.stringify(validBody),
    })
    const res = await app.request('/feedback', {
      headers: { Authorization: `Bearer ${SECRET}` },
    })
    expect(res.status).toBe(200)
    const list = await res.json() as unknown[]
    expect(list.length).toBe(1)
  })
})

describe('PATCH /feedback/:id', () => {
  it('fires a feedback.status_changed webhook when status changes', async () => {
    const received: Array<{ event: string }> = []

    vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
      if (typeof init?.body === 'string') {
        received.push(JSON.parse(init.body) as { event: string })
      }
      return new Response(null, { status: 200 })
    })

    const app = createApp({
      store: createMemoryStore(),
      demoMode: true,
      webhooks: [{ url: 'https://example.com/webhook', secret: WEBHOOK_SECRET }],
    })

    const createRes = await app.request('/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    const created = await createRes.json() as { id: string }

    await new Promise((r) => setTimeout(r, 10))
    const beforeCount = received.length

    await app.request(`/feedback/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'accepted' }),
    })

    await new Promise((r) => setTimeout(r, 10))

    const statusEvents = received.slice(beforeCount).filter((e) => e.event === 'feedback.status_changed')
    expect(statusEvents.length).toBe(1)

    vi.restoreAllMocks()
  })

  it('returns 404 for unknown id', async () => {
    const app = makeApp()
    const res = await app.request('/feedback/ghost-id', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SECRET}` },
      body: JSON.stringify({ status: 'reviewed' }),
    })
    expect(res.status).toBe(404)
  })
})

// ─── signWebhook unit ─────────────────────────────────────────────────────────

describe('signWebhook', () => {
  it('produces a verifiable t=...,v1=... signature', () => {
    const payload = '{"event":"test"}'
    const secret = 'my-secret'
    const sig = signWebhook(payload, secret)

    const match = sig.match(/^t=(\d+),v1=([a-f0-9]+)$/)
    expect(match).not.toBeNull()
    const [, ts, v1] = match!
    const expected = createHmac('sha256', secret).update(`${ts}.${payload}`).digest('hex')
    expect(v1).toBe(expected)
  })
})
