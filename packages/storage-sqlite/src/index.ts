import Database from 'better-sqlite3'
import type {
  FeedbackInput,
  FeedbackRecord,
  FeedbackFilters,
  FeedbackStore,
  FeedbackUpdateFields,
  FeedbackStatus,
  FeedbackCategory,
  PipelineState,
} from '@ericgallitto/feedback-contract'

type StoreListener = (event: 'created' | 'updated', record: FeedbackRecord) => void

interface RawRow {
  id: string
  user_id: string | null
  user_email: string
  user_name: string | null
  page_url: string
  page_name: string | null
  element_selector: string | null
  element_label: string | null
  element_breadcrumb: string | null
  element_type: string | null
  section_heading: string | null
  surrounding_text: string | null
  viewport_context: string
  category: string
  comment: string
  status: string
  priority: number | null
  pipeline_state: string
  admin_notes: string | null
  reviewed_at: string | null
  agent_summary: string | null
  agent_tags: string
  created_at: string
  updated_at: string
}

const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  user_email TEXT NOT NULL,
  user_name TEXT,
  page_url TEXT NOT NULL,
  page_name TEXT,
  element_selector TEXT,
  element_label TEXT,
  element_breadcrumb TEXT,
  element_type TEXT,
  section_heading TEXT,
  surrounding_text TEXT,
  viewport_context TEXT NOT NULL DEFAULT '{}',
  category TEXT NOT NULL,
  comment TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  priority INTEGER CHECK (priority BETWEEN 1 AND 5),
  pipeline_state TEXT NOT NULL DEFAULT 'captured',
  admin_notes TEXT,
  reviewed_at TEXT,
  agent_summary TEXT,
  agent_tags TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_page_url ON feedback(page_url);
`

function rowToRecord(row: RawRow): FeedbackRecord {
  return {
    id: row.id,
    user_id: row.user_id,
    user_email: row.user_email,
    user_name: row.user_name,
    page_url: row.page_url,
    page_name: row.page_name,
    element_selector: row.element_selector,
    element_label: row.element_label,
    element_breadcrumb: row.element_breadcrumb,
    element_type: row.element_type,
    section_heading: row.section_heading,
    surrounding_text: row.surrounding_text,
    viewport_context: JSON.parse(row.viewport_context) as Record<string, unknown>,
    category: row.category as FeedbackCategory,
    comment: row.comment,
    status: row.status as FeedbackStatus,
    priority: row.priority,
    pipeline_state: row.pipeline_state as PipelineState,
    admin_notes: row.admin_notes,
    reviewed_at: row.reviewed_at,
    agent_summary: row.agent_summary,
    agent_tags: JSON.parse(row.agent_tags) as string[],
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

/** Create a SQLite-backed FeedbackStore. Runs synchronous better-sqlite3 wrapped in Promises. */
export function createSqliteStore(dbPath: string): FeedbackStore {
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.exec(CREATE_TABLE)

  const listeners = new Set<StoreListener>()

  function notify(event: 'created' | 'updated', record: FeedbackRecord): void {
    listeners.forEach((l) => l(event, record))
  }

  return {
    async create(input: FeedbackInput): Promise<FeedbackRecord> {
      const now = new Date().toISOString()
      const id = crypto.randomUUID()

      const user_id =
        'user_id' in input && typeof input.user_id === 'string' ? input.user_id : null
      const user_email =
        'user_email' in input && typeof input.user_email === 'string'
          ? input.user_email
          : (user_id ?? '')

      db.prepare(`
        INSERT INTO feedback (
          id, user_id, user_email, user_name,
          page_url, page_name,
          element_selector, element_label, element_breadcrumb, element_type,
          section_heading, surrounding_text, viewport_context,
          category, comment,
          status, priority, pipeline_state, admin_notes, reviewed_at,
          agent_summary, agent_tags,
          created_at, updated_at
        ) VALUES (
          @id, @user_id, @user_email, @user_name,
          @page_url, @page_name,
          @element_selector, @element_label, @element_breadcrumb, @element_type,
          @section_heading, @surrounding_text, @viewport_context,
          @category, @comment,
          'new', NULL, 'captured', NULL, NULL,
          NULL, '[]',
          @created_at, @updated_at
        )
      `).run({
        id,
        user_id,
        user_email,
        user_name: input.user_name ?? null,
        page_url: input.page_url,
        page_name: input.page_name ?? null,
        element_selector: input.element_selector ?? null,
        element_label: input.element_label ?? null,
        element_breadcrumb: input.element_breadcrumb ?? null,
        element_type: input.element_type ?? null,
        section_heading: input.section_heading ?? null,
        surrounding_text: input.surrounding_text ?? null,
        viewport_context: JSON.stringify(input.viewport_context ?? {}),
        category: input.category,
        comment: input.comment,
        created_at: now,
        updated_at: now,
      })

      const row = db.prepare('SELECT * FROM feedback WHERE id = ?').get(id) as RawRow
      const record = rowToRecord(row)
      notify('created', record)
      return record
    },

    async get(id: string): Promise<FeedbackRecord | null> {
      const row = db.prepare('SELECT * FROM feedback WHERE id = ?').get(id) as RawRow | undefined
      return row ? rowToRecord(row) : null
    },

    async list(filters?: FeedbackFilters): Promise<FeedbackRecord[]> {
      let sql = 'SELECT * FROM feedback WHERE 1=1'
      const params: Record<string, string> = {}

      if (filters?.status) {
        sql += ' AND status = @status'
        params['status'] = filters.status
      }
      if (filters?.category) {
        sql += ' AND category = @category'
        params['category'] = filters.category
      }
      if (filters?.page) {
        sql += ' AND page_url = @page'
        params['page'] = filters.page
      }
      if (filters?.userId) {
        sql += ' AND user_id = @userId'
        params['userId'] = filters.userId
      }
      if (filters?.pipeline_state) {
        sql += ' AND pipeline_state = @pipeline_state'
        params['pipeline_state'] = filters.pipeline_state
      }

      sql += ' ORDER BY created_at DESC'

      const rows = db.prepare(sql).all(params) as RawRow[]
      return rows.map(rowToRecord)
    },

    async update(id: string, fields: FeedbackUpdateFields): Promise<FeedbackRecord> {
      const existing = db.prepare('SELECT * FROM feedback WHERE id = ?').get(id) as
        | RawRow
        | undefined
      if (!existing) throw new Error(`Feedback item not found: ${id}`)

      const now = new Date().toISOString()
      const sets: string[] = ['updated_at = @updated_at']
      const params: Record<string, string | number | null> = { id, updated_at: now }

      if (fields.status !== undefined) {
        sets.push('status = @status')
        params['status'] = fields.status
      }
      if (fields.priority !== undefined) {
        sets.push('priority = @priority')
        params['priority'] = fields.priority
      }
      if (fields.admin_notes !== undefined) {
        sets.push('admin_notes = @admin_notes')
        params['admin_notes'] = fields.admin_notes
      }
      if (fields.reviewed_at !== undefined) {
        sets.push('reviewed_at = @reviewed_at')
        params['reviewed_at'] = fields.reviewed_at
      }
      if (fields.pipeline_state !== undefined) {
        sets.push('pipeline_state = @pipeline_state')
        params['pipeline_state'] = fields.pipeline_state
      }
      if (fields.agent_summary !== undefined) {
        sets.push('agent_summary = @agent_summary')
        params['agent_summary'] = fields.agent_summary
      }
      if (fields.agent_tags !== undefined) {
        sets.push('agent_tags = @agent_tags')
        params['agent_tags'] = JSON.stringify(fields.agent_tags)
      }

      db.prepare(`UPDATE feedback SET ${sets.join(', ')} WHERE id = @id`).run(params)

      const updated = db.prepare('SELECT * FROM feedback WHERE id = ?').get(id) as RawRow
      const record = rowToRecord(updated)
      notify('updated', record)
      return record
    },

    async delete(id: string): Promise<void> {
      db.prepare('DELETE FROM feedback WHERE id = ?').run(id)
    },

    subscribe(listener: StoreListener): () => void {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
