export const HIGHLIGHT_STYLE = {
  outline: '2px solid #fb923c',
  outlineOffset: '3px',
  boxShadow: '0 0 0 6px rgba(34, 197, 94, 0.25)',
} as const

const HIGHLIGHT_ATTR = 'data-feedback-highlighted'

/** Apply hover/selection highlight styles to an element. */
export function applyHighlight(el: HTMLElement): void {
  el.style.outline = HIGHLIGHT_STYLE.outline
  el.style.outlineOffset = HIGHLIGHT_STYLE.outlineOffset
  el.style.boxShadow = HIGHLIGHT_STYLE.boxShadow
  el.setAttribute(HIGHLIGHT_ATTR, '1')
}

/** Remove highlight styles from an element. */
export function removeHighlight(el: HTMLElement): void {
  el.style.outline = ''
  el.style.outlineOffset = ''
  el.style.boxShadow = ''
  el.removeAttribute(HIGHLIGHT_ATTR)
}

/** Remove highlight from all highlighted elements in the document. */
export function clearAllHighlights(): void {
  document.querySelectorAll(`[${HIGHLIGHT_ATTR}]`).forEach((el) => {
    removeHighlight(el as HTMLElement)
  })
  // Belt-and-suspenders: also catch any inline-styled elements
  document.querySelectorAll('[style*="outline"]').forEach((el) => {
    removeHighlight(el as HTMLElement)
  })
}
