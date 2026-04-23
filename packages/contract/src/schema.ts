/**
 * JSON Schema draft-07 objects for FeedbackInput and FeedbackRecord.
 *
 * These are pure data — no runtime AJV dependency. Consumers import these
 * objects and pass them to their own AJV (or compatible) instance.
 */

// ---------------------------------------------------------------------------
// Minimal JSON Schema draft-07 structural type
// ---------------------------------------------------------------------------

type JSONSchemaObject = {
  $schema?: string
  type?: string | string[]
  properties?: Record<string, JSONSchemaObject>
  required?: string[]
  additionalProperties?: boolean | JSONSchemaObject
  items?: JSONSchemaObject
  enum?: unknown[]
  const?: unknown
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  default?: unknown
  nullable?: boolean
  oneOf?: JSONSchemaObject[]
  anyOf?: JSONSchemaObject[]
  allOf?: JSONSchemaObject[]
  $ref?: string
  description?: string
  format?: string
}

// ---------------------------------------------------------------------------
// Shared sub-schemas
// ---------------------------------------------------------------------------

const feedbackStatusEnum: JSONSchemaObject = {
  type: 'string',
  enum: ['new', 'reviewed', 'accepted', 'deferred', 'rejected'],
}

const feedbackCategoryEnum: JSONSchemaObject = {
  type: 'string',
  enum: ['bug', 'ui_suggestion', 'missing_feature', 'confusing', 'general'],
}

const pipelineStateEnum: JSONSchemaObject = {
  type: 'string',
  enum: [
    'captured',
    'triaged',
    'plan_approved',
    'in_progress',
    'code_review',
    'ship_approved',
    'shipped',
    'closed',
  ],
}

const nullableString: JSONSchemaObject = {
  anyOf: [{ type: 'string' }, { type: 'null' }],
}

const nullableInteger: JSONSchemaObject = {
  anyOf: [{ type: 'integer', minimum: 1, maximum: 5 }, { type: 'null' }],
}

const viewportContextSchema: JSONSchemaObject = {
  type: 'object',
  additionalProperties: true,
}

// ---------------------------------------------------------------------------
// feedbackInputSchema
// ---------------------------------------------------------------------------

export const feedbackInputSchema: JSONSchemaObject = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['page_url', 'category', 'comment'],
  additionalProperties: false,
  properties: {
    // Page context
    page_url: {
      type: 'string',
      minLength: 1,
      description: 'The URL of the page where feedback was submitted.',
    },
    page_name: {
      anyOf: [{ type: 'string' }, { type: 'null' }],
    },
    // Element context (all optional)
    element_selector: nullableString,
    element_label: nullableString,
    element_breadcrumb: nullableString,
    element_type: nullableString,
    section_heading: nullableString,
    surrounding_text: {
      anyOf: [{ type: 'string', maxLength: 300 }, { type: 'null' }],
    },
    viewport_context: {
      anyOf: [viewportContextSchema, { type: 'null' }],
    },
    // Core feedback
    category: feedbackCategoryEnum,
    comment: {
      type: 'string',
      minLength: 1,
      description: 'The user-supplied feedback comment.',
    },
    // Identity
    user_id: nullableString,
    user_email: {
      type: 'string',
      description: 'Required when user_id is not provided.',
    },
    user_name: nullableString,
  },
}

// ---------------------------------------------------------------------------
// feedbackRecordSchema
// ---------------------------------------------------------------------------

export const feedbackRecordSchema: JSONSchemaObject = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: [
    'id',
    'page_url',
    'category',
    'comment',
    'page_name',
    'element_selector',
    'element_label',
    'element_breadcrumb',
    'element_type',
    'section_heading',
    'surrounding_text',
    'viewport_context',
    'user_id',
    'user_email',
    'user_name',
    'status',
    'priority',
    'pipeline_state',
    'admin_notes',
    'reviewed_at',
    'agent_summary',
    'agent_tags',
    'created_at',
    'updated_at',
  ],
  additionalProperties: false,
  properties: {
    // Identity/keys
    id: { type: 'string', minLength: 1 },
    // Input fields (normalised — no longer optional on the record)
    page_url: { type: 'string', minLength: 1 },
    page_name: nullableString,
    element_selector: nullableString,
    element_label: nullableString,
    element_breadcrumb: nullableString,
    element_type: nullableString,
    section_heading: nullableString,
    surrounding_text: {
      anyOf: [{ type: 'string', maxLength: 300 }, { type: 'null' }],
    },
    viewport_context: viewportContextSchema,
    user_id: nullableString,
    user_email: { type: 'string' },
    user_name: nullableString,
    // Core feedback
    category: feedbackCategoryEnum,
    comment: { type: 'string', minLength: 1 },
    // Server-assigned
    status: feedbackStatusEnum,
    priority: nullableInteger,
    pipeline_state: pipelineStateEnum,
    admin_notes: nullableString,
    reviewed_at: nullableString,
    // Agent enrichment
    agent_summary: nullableString,
    agent_tags: {
      type: 'array',
      items: { type: 'string' },
      default: [],
    },
    // Timestamps
    created_at: { type: 'string' },
    updated_at: { type: 'string' },
  },
}
