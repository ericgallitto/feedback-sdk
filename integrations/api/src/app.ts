import { Hono } from 'hono'
import { cors } from 'hono/cors'
import {
  feedbackInputSchema as _feedbackInputSchema,
  type FeedbackStore,
  type FeedbackFilters,
  type FeedbackUpdateFields,
  type FeedbackInput,
  type FeedbackCreatedEvent,
  type FeedbackStatusChangedEvent,
  type FeedbackStatus,
  type FeedbackCategory,
  type PipelineState,
} from '@ericgallitto/feedback-contract'
import { requirePublishableKey, requireSecretKey, type AuthConfig } from './auth.js'
import { deliverWebhooks, type WebhookConfig } from './webhooks.js'

export interface AppConfig extends AuthConfig {
  store: FeedbackStore
  webhooks?: WebhookConfig[]
  corsOrigins?: string | string[]
}

// ── Inline validator (avoids AJV ESM/NodeNext compat friction) ────────────────

const VALID_CATEGORIES = new Set(
  (_feedbackInputSchema.properties as Record<string, { enum?: string[] }>)['category']?.['enum'] ??
    ['bug', 'ui_suggestion', 'missing_feature', 'confusing', 'general'],
)

type ValidationResult =
  | { ok: true; value: FeedbackInput }
  | { ok: false; error: string }

function validateInput(body: unknown): ValidationResult {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'Body must be a JSON object' }
  }
  const b = body as Record<string, unknown>

  if (typeof b['page_url'] !== 'string' || b['page_url'].length === 0) {
    return { ok: false, error: 'page_url is required and must be a non-empty string' }
  }
  if (typeof b['comment'] !== 'string' || b['comment'].length === 0) {
    return { ok: false, error: 'comment is required and must be a non-empty string' }
  }
  if (!VALID_CATEGORIES.has(b['category'] as string)) {
    return { ok: false, error: `category must be one of: ${Array.from(VALID_CATEGORIES).join(', ')}` }
  }
  const hasUserId = typeof b['user_id'] === 'string' && b['user_id'].length > 0
  const hasEmail = typeof b['user_email'] === 'string' && b['user_email'].length > 0
  if (!hasUserId && !hasEmail) {
    return { ok: false, error: 'Either user_id or user_email must be provided' }
  }

  return { ok: true, value: b as unknown as FeedbackInput }
}

// ─────────────────────────────────────────────────────────────────────────────

export function createApp(config: AppConfig): Hono {
  const { store, webhooks = [], corsOrigins = '*' } = config
  const app = new Hono()

  app.use('*', cors({ origin: corsOrigins }))

  // ── Health ──────────────────────────────────────────────────────────────────
  app.get('/healthz', (c) => c.json({ ok: true }))

  // ── Submit ──────────────────────────────────────────────────────────────────
  app.post('/feedback', requirePublishableKey(config), async (c) => {
    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400)
    }

    const result = validateInput(body)
    if (!result.ok) return c.json({ error: result.error }, 400)

    const record = await store.create(result.value)

    const event: FeedbackCreatedEvent = {
      event: 'feedback.created',
      timestamp: new Date().toISOString(),
      data: record,
    }
    void deliverWebhooks(webhooks, event)

    return c.json(record, 201)
  })

  // ── List ────────────────────────────────────────────────────────────────────
  app.get('/feedback', requireSecretKey(config), async (c) => {
    const filters: FeedbackFilters = {}
    const status = c.req.query('status') as FeedbackStatus | undefined
    const category = c.req.query('category') as FeedbackCategory | undefined
    const page = c.req.query('page')
    const userId = c.req.query('userId')
    const pipelineState = c.req.query('pipeline_state') as PipelineState | undefined

    if (status) filters.status = status
    if (category) filters.category = category
    if (page) filters.page = page
    if (userId) filters.userId = userId
    if (pipelineState) filters.pipeline_state = pipelineState

    const items = await store.list(filters)
    return c.json(items)
  })

  // ── Get one ─────────────────────────────────────────────────────────────────
  app.get('/feedback/:id', requireSecretKey(config), async (c) => {
    const id = c.req.param('id')
    const item = await store.get(id)
    if (!item) return c.json({ error: 'Not found' }, 404)
    return c.json(item)
  })

  // ── Update ──────────────────────────────────────────────────────────────────
  app.patch('/feedback/:id', requireSecretKey(config), async (c) => {
    const id = c.req.param('id')
    const existing = await store.get(id)
    if (!existing) return c.json({ error: 'Not found' }, 404)

    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400)
    }

    if (typeof body !== 'object' || body === null) {
      return c.json({ error: 'Body must be an object' }, 400)
    }

    const fields = body as FeedbackUpdateFields
    const previousStatus = existing.status
    const updated = await store.update(id, fields)

    if (fields.status && fields.status !== previousStatus) {
      const event: FeedbackStatusChangedEvent = {
        event: 'feedback.status_changed',
        timestamp: new Date().toISOString(),
        data: updated,
        previous_status: previousStatus,
      }
      void deliverWebhooks(webhooks, event)
    }

    return c.json(updated)
  })

  // ── Delete ──────────────────────────────────────────────────────────────────
  app.delete('/feedback/:id', requireSecretKey(config), async (c) => {
    const id = c.req.param('id')
    const existing = await store.get(id)
    if (!existing) return c.json({ error: 'Not found' }, 404)
    await store.delete(id)
    return c.body(null, 204)
  })

  return app
}
