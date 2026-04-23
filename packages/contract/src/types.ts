// ---------------------------------------------------------------------------
// String literal union types (enums)
// ---------------------------------------------------------------------------

export type FeedbackStatus =
  | 'new'
  | 'reviewed'
  | 'accepted'
  | 'deferred'
  | 'rejected'

export type FeedbackCategory =
  | 'bug'
  | 'ui_suggestion'
  | 'missing_feature'
  | 'confusing'
  | 'general'

export type PipelineState =
  | 'captured'
  | 'triaged'
  | 'plan_approved'
  | 'in_progress'
  | 'code_review'
  | 'ship_approved'
  | 'shipped'
  | 'closed'

// ---------------------------------------------------------------------------
// Element context captured from the DOM at click time
// ---------------------------------------------------------------------------

export interface ElementContext {
  /** e.g. "Settings > Billing > Change Plan button" */
  breadcrumb: string
  /** 'button' | 'link' | 'input' | 'table' | etc. */
  elementType: string
  sectionHeading: string | null
  /** ≤300 chars */
  surroundingText: string | null
  viewportContext: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// What the widget submits — no server-assigned fields
// ---------------------------------------------------------------------------

export interface FeedbackInput {
  // Page context
  page_url: string
  page_name?: string | null
  // Element context (optional — user may submit without selecting an element)
  element_selector?: string | null
  element_label?: string | null
  element_breadcrumb?: string | null
  element_type?: string | null
  section_heading?: string | null
  surrounding_text?: string | null
  viewport_context?: Record<string, unknown>
  // Core feedback
  category: FeedbackCategory
  comment: string
  // Identity (supplied by host app or magic-link verified email)
  /** present when signed-in identity adapter used */
  user_id?: string | null
  /** required if user_id not provided (verified email path) */
  user_email?: string
  user_name?: string | null
}

// ---------------------------------------------------------------------------
// Full stored record — server-assigned fields added
// ---------------------------------------------------------------------------

export interface FeedbackRecord
  extends Required<Pick<FeedbackInput, 'page_url' | 'category' | 'comment'>> {
  // All FeedbackInput fields (normalised to non-optional)
  page_name: string | null
  element_selector: string | null
  element_label: string | null
  element_breadcrumb: string | null
  element_type: string | null
  section_heading: string | null
  surrounding_text: string | null
  viewport_context: Record<string, unknown>
  user_id: string | null
  user_email: string
  user_name: string | null
  // Server-assigned
  id: string
  status: FeedbackStatus
  /** 1–5 */
  priority: number | null
  pipeline_state: PipelineState
  admin_notes: string | null
  reviewed_at: string | null
  // Agent-enrichment fields
  agent_summary: string | null
  agent_tags: string[]
  // Timestamps (ISO 8601)
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Query filters
// ---------------------------------------------------------------------------

export interface FeedbackFilters {
  status?: FeedbackStatus
  category?: FeedbackCategory
  page?: string
  userId?: string
  pipeline_state?: PipelineState
}

// ---------------------------------------------------------------------------
// Webhook event payloads
// ---------------------------------------------------------------------------

export interface FeedbackCreatedEvent {
  event: 'feedback.created'
  timestamp: string
  data: FeedbackRecord
}

export interface FeedbackStatusChangedEvent {
  event: 'feedback.status_changed'
  timestamp: string
  data: FeedbackRecord
  previous_status: FeedbackStatus
}

export type FeedbackWebhookEvent =
  | FeedbackCreatedEvent
  | FeedbackStatusChangedEvent
