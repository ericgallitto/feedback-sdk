/**
 * Generates openapi.json in the package root from the JSON Schema objects
 * and type definitions in src/.
 *
 * Run via: pnpm run gen-openapi
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Import schema data directly from source (tsx resolves .ts imports)
import { feedbackInputSchema, feedbackRecordSchema } from '../src/schema.js'
import type { FeedbackStatus, PipelineState } from '../src/types.js'

const FEEDBACK_STATUS_ENUM: FeedbackStatus[] = ['new', 'reviewed', 'accepted', 'deferred', 'rejected']
const PIPELINE_STATE_ENUM: PipelineState[] = [
  'captured', 'triaged', 'plan_approved', 'in_progress',
  'code_review', 'ship_approved', 'shipped', 'closed',
]

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const packageRoot = resolve(__dirname, '..')

// ---------------------------------------------------------------------------
// Shared component schemas referenced in the spec
// ---------------------------------------------------------------------------

// Strip the $schema key from sub-schemas used as components
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { $schema: _inputDraft, ...feedbackInputComponent } = feedbackInputSchema
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { $schema: _recordDraft, ...feedbackRecordComponent } = feedbackRecordSchema

const feedbackPatchSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: {
      type: 'string',
      enum: FEEDBACK_STATUS_ENUM,
    },
    priority: {
      anyOf: [{ type: 'integer', minimum: 1, maximum: 5 }, { type: 'null' }],
    },
    admin_notes: {
      anyOf: [{ type: 'string' }, { type: 'null' }],
    },
    pipeline_state: {
      type: 'string',
      enum: PIPELINE_STATE_ENUM,
    },
  },
}

// ---------------------------------------------------------------------------
// OpenAPI 3.1 spec
// ---------------------------------------------------------------------------

const spec = {
  openapi: '3.1.0',
  info: {
    title: 'Feedback SDK API',
    version: '0.1.0',
    description:
      'HTTP API for the @ericgallitto/feedback-sdk. Accepts user feedback, exposes it for review, and provides webhook events.',
  },
  paths: {
    '/feedback': {
      post: {
        operationId: 'createFeedback',
        summary: 'Submit feedback',
        description: 'Submit a new feedback item from the widget.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/FeedbackInput' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Feedback created successfully.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/FeedbackRecord' },
              },
            },
          },
          '400': { description: 'Validation error.' },
          '422': { description: 'Unprocessable entity.' },
        },
      },
      get: {
        operationId: 'listFeedback',
        summary: 'List feedback',
        description: 'Retrieve a list of feedback records, optionally filtered.',
        parameters: [
          {
            name: 'status',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['new', 'reviewed', 'accepted', 'deferred', 'rejected'],
            },
          },
          {
            name: 'category',
            in: 'query',
            schema: {
              type: 'string',
              enum: [
                'bug',
                'ui_suggestion',
                'missing_feature',
                'confusing',
                'general',
              ],
            },
          },
          {
            name: 'page',
            in: 'query',
            schema: { type: 'string' },
            description: 'Filter by page URL substring.',
          },
          {
            name: 'userId',
            in: 'query',
            schema: { type: 'string' },
            description: 'Filter by user ID.',
          },
          {
            name: 'pipeline_state',
            in: 'query',
            schema: {
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
            },
          },
        ],
        responses: {
          '200': {
            description: 'List of feedback records.',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/FeedbackRecord' },
                },
              },
            },
          },
        },
      },
    },
    '/feedback/{id}': {
      get: {
        operationId: 'getFeedback',
        summary: 'Get a feedback record',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'The feedback record.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/FeedbackRecord' },
              },
            },
          },
          '404': { description: 'Not found.' },
        },
      },
      patch: {
        operationId: 'patchFeedback',
        summary: 'Update a feedback record',
        description:
          'Partially update status, priority, admin notes, or pipeline state.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/FeedbackPatch' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Updated feedback record.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/FeedbackRecord' },
              },
            },
          },
          '400': { description: 'Validation error.' },
          '404': { description: 'Not found.' },
        },
      },
    },
  },
  components: {
    schemas: {
      FeedbackInput: feedbackInputComponent,
      FeedbackRecord: feedbackRecordComponent,
      FeedbackPatch: feedbackPatchSchema,
    },
  },
}

// ---------------------------------------------------------------------------
// Write output
// ---------------------------------------------------------------------------

const outPath = resolve(packageRoot, 'openapi.json')
mkdirSync(packageRoot, { recursive: true })
writeFileSync(outPath, JSON.stringify(spec, null, 2) + '\n', 'utf-8')
console.log(`openapi.json written to ${outPath}`)
