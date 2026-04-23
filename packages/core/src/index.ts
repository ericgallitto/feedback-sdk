// Re-export ElementContext type from contract (this is the shared contract type)
export type { ElementContext } from '@ericgallitto/feedback-contract'

// Context capture
export {
  captureElementContext,
  buildBreadcrumb,
  inferElementType,
  findSectionHeading,
  captureSurroundingText,
  findActiveTab,
  extractRouteParams,
} from './context.js'

// Selector utilities
export { buildSelector, findFeedbackLabel } from './selector.js'

// Highlight utilities
export {
  HIGHLIGHT_STYLE,
  applyHighlight,
  removeHighlight,
  clearAllHighlights,
} from './highlight.js'

// Deep-link utilities
export { scrollToSelector, pulseElement } from './deeplink.js'
