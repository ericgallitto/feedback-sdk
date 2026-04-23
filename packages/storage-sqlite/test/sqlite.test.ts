import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createSqliteStore } from '../src/index.js'
import type { FeedbackInput } from '@ericgallitto/feedback-contract'

const minimalInput: FeedbackInput = {
  page_url: 'https://app.example.com/home',
  category: 'bug',
  comment: 'Test feedback comment.',
  user_email: 'test@example.com',
}

let tmpDir: string
let dbPath: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'feedback-sqlite-test-'))
  dbPath = join(tmpDir, 'feedback.db')
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('createSqliteStore', () => {
  it('creates a record and assigns server-side defaults', async () => {
    const store = createSqliteStore(dbPath)
    const record = await store.create(minimalInput)

    expect(record.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(record.page_url).toBe(minimalInput.page_url)
    expect(record.category).toBe('bug')
    expect(record.comment).toBe(minimalInput.comment)
    expect(record.user_email).toBe('test@example.com')
    expect(record.user_id).toBeNull()
    expect(record.status).toBe('new')
    expect(record.pipeline_state).toBe('captured')
    expect(record.priority).toBeNull()
    expect(record.agent_tags).toEqual([])
    expect(record.created_at).toBeTruthy()
    expect(record.updated_at).toBe(record.created_at)
  })

  it('creates a record with user_id identity', async () => {
    const store = createSqliteStore(dbPath)
    const record = await store.create({
      ...minimalInput,
      user_id: 'usr_123',
      user_name: 'Test User',
    })
    expect(record.user_id).toBe('usr_123')
    expect(record.user_name).toBe('Test User')
  })

  it('gets a record by id', async () => {
    const store = createSqliteStore(dbPath)
    const created = await store.create(minimalInput)
    const fetched = await store.get(created.id)
    expect(fetched).not.toBeNull()
    expect(fetched!.id).toBe(created.id)
  })

  it('returns null for a missing id', async () => {
    const store = createSqliteStore(dbPath)
    const result = await store.get('nonexistent-id')
    expect(result).toBeNull()
  })

  it('lists all records, newest first', async () => {
    const store = createSqliteStore(dbPath)
    const a = await store.create(minimalInput)
    await new Promise((r) => setTimeout(r, 5))
    const b = await store.create({ ...minimalInput, comment: 'Second item' })
    const list = await store.list()
    expect(list.length).toBe(2)
    expect(list[0].id).toBe(b.id)
    expect(list[1].id).toBe(a.id)
  })

  it('lists records filtered by status', async () => {
    const store = createSqliteStore(dbPath)
    await store.create(minimalInput)
    const created = await store.create(minimalInput)
    await store.update(created.id, { status: 'accepted' })
    const accepted = await store.list({ status: 'accepted' })
    expect(accepted.length).toBe(1)
    expect(accepted[0].id).toBe(created.id)
  })

  it('lists records filtered by category', async () => {
    const store = createSqliteStore(dbPath)
    await store.create(minimalInput)
    await store.create({ ...minimalInput, category: 'ui_suggestion' })
    const bugs = await store.list({ category: 'bug' })
    expect(bugs.length).toBe(1)
  })

  it('updates status and triggers subscriber', async () => {
    const store = createSqliteStore(dbPath)

    const events: Array<{ event: string; id: string }> = []
    const unsub = store.subscribe((event, r) => events.push({ event, id: r.id }))

    const record = await store.create(minimalInput)
    expect(events).toHaveLength(1)
    expect(events[0].event).toBe('created')

    const updated = await store.update(record.id, { status: 'reviewed' })
    expect(updated.status).toBe('reviewed')
    expect(updated.updated_at >= record.updated_at).toBe(true)
    expect(events).toHaveLength(2)
    expect(events[1].event).toBe('updated')

    unsub()
    await store.update(record.id, { status: 'accepted' })
    expect(events).toHaveLength(2) // unsubscribed — no new event
  })

  it('updates pipeline_state, priority, admin_notes, agent fields', async () => {
    const store = createSqliteStore(dbPath)
    const record = await store.create(minimalInput)
    const updated = await store.update(record.id, {
      pipeline_state: 'triaged',
      priority: 2,
      admin_notes: 'Confirmed bug',
      agent_summary: 'Save button click handler not wired',
      agent_tags: ['billing', 'critical'],
    })
    expect(updated.pipeline_state).toBe('triaged')
    expect(updated.priority).toBe(2)
    expect(updated.admin_notes).toBe('Confirmed bug')
    expect(updated.agent_summary).toBe('Save button click handler not wired')
    expect(updated.agent_tags).toEqual(['billing', 'critical'])
  })

  it('throws on update with unknown id', async () => {
    const store = createSqliteStore(dbPath)
    await expect(store.update('ghost-id', { status: 'reviewed' })).rejects.toThrow(
      'Feedback item not found: ghost-id',
    )
  })

  it('deletes a record', async () => {
    const store = createSqliteStore(dbPath)
    const record = await store.create(minimalInput)
    await store.delete(record.id)
    const fetched = await store.get(record.id)
    expect(fetched).toBeNull()
  })

  it('persists across store re-instantiation (same db file)', async () => {
    const store1 = createSqliteStore(dbPath)
    const created = await store1.create(minimalInput)

    const store2 = createSqliteStore(dbPath)
    const fetched = await store2.get(created.id)
    expect(fetched).not.toBeNull()
    expect(fetched!.comment).toBe(minimalInput.comment)
  })
})
