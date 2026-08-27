/**
 * Element highlighting for the picker.
 *
 * Two distinct states, because they answer different questions:
 *
 *   hover    — "this is what you would select if you clicked now"
 *   selected — "this is what your feedback is attached to"
 *
 * Selected persists while the composer is open, so the person can see what
 * they picked while they describe it.
 *
 * Styling is done with an injected stylesheet keyed off data attributes rather
 * than by writing inline styles onto the element. Inline styles cannot be
 * removed cleanly: clearing them blanks any outline or box-shadow the page
 * author had set, and there is no way to tell which was ours. An attribute is
 * removed exactly, leaving the element as it was found.
 *
 * Colours come from CSS custom properties so a host app can theme the picker
 * to match itself. They resolve against :root, so set them there or on <body>.
 */

const STYLE_ID = 'feedback-highlight-styles'
const HOVER_ATTR = 'data-feedback-hover'
const SELECTED_ATTR = 'data-feedback-selected'

/** @deprecated Kept for compatibility. Styling now comes from the stylesheet. */
export const HIGHLIGHT_STYLE = {
  outline: '2px solid #fb923c',
  outlineOffset: '3px',
  boxShadow: '0 0 0 6px rgba(34, 197, 94, 0.25)',
} as const

function injectStyles(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
[${HOVER_ATTR}] {
  outline: 2px dashed var(--feedback-highlight, #6366f1) !important;
  outline-offset: 2px !important;
  cursor: crosshair !important;
}
[${SELECTED_ATTR}] {
  outline: 2px solid var(--feedback-highlight-selected, var(--feedback-highlight, #6366f1)) !important;
  outline-offset: 2px !important;
  box-shadow: 0 0 0 4px var(--feedback-highlight-halo, rgba(99, 102, 241, 0.18)) !important;
}
/* Selected wins while both are set, so moving the cursor back over your own
   choice does not make it look unpicked. */
[${SELECTED_ATTR}][${HOVER_ATTR}] {
  outline-style: solid !important;
}
`
  document.head.appendChild(style)
}

// ── Hover ────────────────────────────────────────────────────────────────────
//
// Exactly one element is hovered at a time. The caller passes the element under
// the cursor and this clears whatever was hovered before, which is what stops
// nested elements from flickering as the cursor crosses their boundaries.

let hovered: HTMLElement | null = null

export function markHover(el: HTMLElement | null): void {
  if (el === hovered) return
  injectStyles()
  if (hovered) hovered.removeAttribute(HOVER_ATTR)
  hovered = el
  if (el) el.setAttribute(HOVER_ATTR, '')
}

export function clearHover(): void {
  if (hovered) hovered.removeAttribute(HOVER_ATTR)
  hovered = null
  // Anything left behind by an element being removed from the DOM mid-hover.
  if (typeof document !== 'undefined') {
    document.querySelectorAll(`[${HOVER_ATTR}]`).forEach((el) => el.removeAttribute(HOVER_ATTR))
  }
}

// ── Selection ────────────────────────────────────────────────────────────────

let selected: HTMLElement | null = null

/** Mark the chosen element and keep it marked until explicitly cleared. */
export function markSelected(el: HTMLElement | null): void {
  injectStyles()
  if (selected && selected !== el) selected.removeAttribute(SELECTED_ATTR)
  selected = el
  if (el) el.setAttribute(SELECTED_ATTR, '')
}

export function clearSelected(): void {
  if (selected) selected.removeAttribute(SELECTED_ATTR)
  selected = null
  if (typeof document !== 'undefined') {
    document.querySelectorAll(`[${SELECTED_ATTR}]`).forEach((el) => el.removeAttribute(SELECTED_ATTR))
  }
}

/** The element currently marked as selected, if it is still in the document. */
export function getSelected(): HTMLElement | null {
  if (selected && !selected.isConnected) selected = null
  return selected
}

// ── Compatibility ────────────────────────────────────────────────────────────

/** @deprecated Use markHover or markSelected. */
export function applyHighlight(el: HTMLElement): void {
  markSelected(el)
}

/** @deprecated Use clearHover or clearSelected. */
export function removeHighlight(el: HTMLElement): void {
  el.removeAttribute(HOVER_ATTR)
  el.removeAttribute(SELECTED_ATTR)
  if (hovered === el) hovered = null
  if (selected === el) selected = null
}

/**
 * Clear every highlight this module applied.
 *
 * Only touches elements carrying our own attributes. A previous version also
 * swept `[style*="outline"]`, which stripped outlines from unrelated page
 * elements that happened to have an inline outline of their own.
 */
export function clearAllHighlights(): void {
  clearHover()
  clearSelected()
}
