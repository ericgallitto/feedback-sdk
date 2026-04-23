import type { FeedbackRecord, FeedbackInput, FeedbackFilters, FeedbackStatus, PipelineState } from './types.js'

export type FeedbackUpdateFields = {
  status?: FeedbackStatus
  priority?: number | null
  admin_notes?: string | null
  reviewed_at?: string | null
  pipeline_state?: PipelineState
  agent_summary?: string | null
  agent_tags?: string[]
}

/**
 * Pluggable storage interface. Implement this to connect any backing store
 * (in-memory, SQLite, Postgres, Supabase, etc.) to the feedback-api server
 * and the feedback-mcp server without changing business logic.
 */
export interface FeedbackStore {
  /** Insert a new item. Returns the persisted record with server-assigned fields. */
  create(input: FeedbackInput): Promise<FeedbackRecord>

  /** Retrieve a single record by id. Returns null if not found. */
  get(id: string): Promise<FeedbackRecord | null>

  /** List records with optional filtering. Returns newest-first. */
  list(filters?: FeedbackFilters): Promise<FeedbackRecord[]>

  /** Update mutable fields on a record. Returns the updated record. */
  update(id: string, fields: FeedbackUpdateFields): Promise<FeedbackRecord>

  /** Delete a record. Resolves when done. */
  delete(id: string): Promise<void>

  /**
   * Optional subscription for real-time events (used by the webhook emitter
   * and MCP server). The listener receives the full record after every
   * create or update.
   */
  subscribe?(listener: (event: 'created' | 'updated', record: FeedbackRecord) => void): () => void
}
