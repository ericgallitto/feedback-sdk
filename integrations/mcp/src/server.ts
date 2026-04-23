import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import type {
  FeedbackStore,
  FeedbackFilters,
  FeedbackUpdateFields,
  FeedbackStatus,
  FeedbackCategory,
  PipelineState,
} from '@ericgallitto/feedback-contract'

const FEEDBACK_STATUS = ['new', 'reviewed', 'accepted', 'deferred', 'rejected'] as const
const FEEDBACK_CATEGORY = ['bug', 'ui_suggestion', 'missing_feature', 'confusing', 'general'] as const
const PIPELINE_STATE = [
  'captured', 'triaged', 'plan_approved', 'in_progress',
  'code_review', 'ship_approved', 'shipped', 'closed',
] as const

export function createMcpServer(store: FeedbackStore): McpServer {
  const server = new McpServer({
    name: 'feedback-sdk',
    version: '0.1.0',
  })

  // ── Tool: list_feedback ─────────────────────────────────────────────────────
  server.tool(
    'list_feedback',
    'List feedback items with optional filters. Returns newest-first.',
    {
      status: z.enum(FEEDBACK_STATUS).optional().describe('Filter by status'),
      category: z.enum(FEEDBACK_CATEGORY).optional().describe('Filter by category'),
      page: z.string().optional().describe('Filter by exact page_url'),
      pipeline_state: z.enum(PIPELINE_STATE).optional().describe('Filter by pipeline state'),
      limit: z.number().int().min(1).max(100).optional().default(20).describe('Max items to return'),
    },
    async ({ status, category, page, pipeline_state, limit }) => {
      const filters: FeedbackFilters = {}
      if (status) filters.status = status as FeedbackStatus
      if (category) filters.category = category as FeedbackCategory
      if (page) filters.page = page
      if (pipeline_state) filters.pipeline_state = pipeline_state as PipelineState

      const items = await store.list(filters)
      const sliced = items.slice(0, limit)

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(sliced, null, 2),
          },
        ],
      }
    },
  )

  // ── Tool: get_feedback ──────────────────────────────────────────────────────
  server.tool(
    'get_feedback',
    'Get a single feedback item by ID.',
    { id: z.string().describe('The feedback item ID (UUID)') },
    async ({ id }) => {
      const item = await store.get(id)
      if (!item) {
        return { content: [{ type: 'text' as const, text: `No feedback found with id: ${id}` }] }
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(item, null, 2) }] }
    },
  )

  // ── Tool: update_feedback ───────────────────────────────────────────────────
  server.tool(
    'update_feedback',
    'Update mutable fields on a feedback item (status, priority, pipeline_state, admin_notes, agent_summary, agent_tags).',
    {
      id: z.string().describe('The feedback item ID'),
      status: z.enum(FEEDBACK_STATUS).optional(),
      priority: z.number().int().min(1).max(5).nullable().optional(),
      pipeline_state: z.enum(PIPELINE_STATE).optional(),
      admin_notes: z.string().nullable().optional(),
      agent_summary: z.string().nullable().optional(),
      agent_tags: z.array(z.string()).optional(),
    },
    async ({ id, ...fields }) => {
      const existing = await store.get(id)
      if (!existing) {
        return { content: [{ type: 'text' as const, text: `No feedback found with id: ${id}` }] }
      }

      const updateFields: FeedbackUpdateFields = {}
      if (fields.status !== undefined) updateFields.status = fields.status as FeedbackStatus
      if (fields.priority !== undefined) updateFields.priority = fields.priority
      if (fields.pipeline_state !== undefined) updateFields.pipeline_state = fields.pipeline_state as PipelineState
      if (fields.admin_notes !== undefined) updateFields.admin_notes = fields.admin_notes
      if (fields.agent_summary !== undefined) updateFields.agent_summary = fields.agent_summary
      if (fields.agent_tags !== undefined) updateFields.agent_tags = fields.agent_tags

      const updated = await store.update(id, updateFields)
      return { content: [{ type: 'text' as const, text: JSON.stringify(updated, null, 2) }] }
    },
  )

  // ── Tool: summarize_feedback ────────────────────────────────────────────────
  server.tool(
    'summarize_feedback',
    'Return a grouped summary of feedback: counts by status, category, and pipeline_state, plus the 5 most recent unreviewed items.',
    {},
    async () => {
      const all = await store.list()
      const byStatus: Record<string, number> = {}
      const byCategory: Record<string, number> = {}
      const byPipeline: Record<string, number> = {}

      for (const item of all) {
        byStatus[item.status] = (byStatus[item.status] ?? 0) + 1
        byCategory[item.category] = (byCategory[item.category] ?? 0) + 1
        byPipeline[item.pipeline_state] = (byPipeline[item.pipeline_state] ?? 0) + 1
      }

      const unreviewed = all.filter((i) => i.status === 'new').slice(0, 5).map((i) => ({
        id: i.id,
        category: i.category,
        comment: i.comment.slice(0, 120),
        page_url: i.page_url,
        created_at: i.created_at,
      }))

      const summary = { total: all.length, byStatus, byCategory, byPipeline, recent_new: unreviewed }
      return { content: [{ type: 'text' as const, text: JSON.stringify(summary, null, 2) }] }
    },
  )

  return server
}

/** Standalone entry point: reads env vars, creates store, starts stdio server. */
export async function startStdioServer(): Promise<void> {
  const storeType = process.env['FEEDBACK_STORE'] ?? 'memory'

  let store: FeedbackStore

  if (storeType === 'sqlite') {
    const path = process.env['FEEDBACK_SQLITE_PATH'] ?? './feedback.db'
    const { createSqliteStore } = await import('@ericgallitto/feedback-storage-sqlite')
    store = createSqliteStore(path)
  } else {
    const { createMemoryStore } = await import('@ericgallitto/feedback-api')
    store = createMemoryStore()
  }

  const mcpServer = createMcpServer(store)
  const transport = new StdioServerTransport()
  await mcpServer.connect(transport)
}
