import type {
  FeedbackInput,
  FeedbackRecord,
  FeedbackFilters,
  FeedbackStore,
  FeedbackUpdateFields,
} from '@ericgallitto/feedback-contract'

type StoreListener = (event: 'created' | 'updated', record: FeedbackRecord) => void

/** In-memory FeedbackStore — suitable for tests and demo mode. Not persistent. */
export function createMemoryStore(): FeedbackStore {
  const records = new Map<string, FeedbackRecord>()
  const listeners = new Set<StoreListener>()

  function notify(event: 'created' | 'updated', record: FeedbackRecord): void {
    listeners.forEach((l) => l(event, record))
  }

  return {
    async create(input: FeedbackInput): Promise<FeedbackRecord> {
      const now = new Date().toISOString()

      // Resolve identity fields
      const user_id = 'user_id' in input && typeof input.user_id === 'string' ? input.user_id : null
      const user_email =
        'user_email' in input && typeof input.user_email === 'string'
          ? input.user_email
          : (user_id ?? '')

      const record: FeedbackRecord = {
        id: crypto.randomUUID(),
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
        viewport_context: input.viewport_context ?? {},
        category: input.category,
        comment: input.comment,
        status: 'new',
        priority: null,
        pipeline_state: 'captured',
        admin_notes: null,
        reviewed_at: null,
        agent_summary: null,
        agent_tags: [],
        created_at: now,
        updated_at: now,
      }
      records.set(record.id, record)
      notify('created', record)
      return record
    },

    async get(id: string): Promise<FeedbackRecord | null> {
      return records.get(id) ?? null
    },

    async list(filters?: FeedbackFilters): Promise<FeedbackRecord[]> {
      let items = Array.from(records.values())
      if (filters?.status) items = items.filter((r) => r.status === filters.status)
      if (filters?.category) items = items.filter((r) => r.category === filters.category)
      if (filters?.page) items = items.filter((r) => r.page_url === filters.page)
      if (filters?.userId) items = items.filter((r) => r.user_id === filters.userId)
      if (filters?.pipeline_state)
        items = items.filter((r) => r.pipeline_state === filters.pipeline_state)
      return items.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
    },

    async update(id: string, fields: FeedbackUpdateFields): Promise<FeedbackRecord> {
      const existing = records.get(id)
      if (!existing) throw new Error(`Feedback item not found: ${id}`)
      const updated: FeedbackRecord = {
        ...existing,
        ...fields,
        updated_at: new Date().toISOString(),
      }
      records.set(id, updated)
      notify('updated', updated)
      return updated
    },

    async delete(id: string): Promise<void> {
      records.delete(id)
    },

    subscribe(listener: StoreListener): () => void {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
