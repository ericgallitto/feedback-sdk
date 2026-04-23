const PULSE_CLASS = 'feedback-pulse'
const PULSE_STYLE_ID = 'feedback-pulse-keyframes'

/**
 * Find an element by CSS selector and scroll it into view.
 * Returns the element if found, null if selector matches nothing.
 */
export function scrollToSelector(
  selector: string,
  behavior: ScrollBehavior = 'smooth',
): HTMLElement | null {
  let el: HTMLElement | null = null
  try {
    el = document.querySelector<HTMLElement>(selector)
  } catch {
    return null
  }
  if (!el) return null
  el.scrollIntoView({ behavior, block: 'center' })
  return el
}

/**
 * Briefly pulse-highlight an element using a CSS animation.
 * Injects a <style> tag with the keyframe on first call (idempotent).
 */
export function pulseElement(el: HTMLElement, durationMs = 1200): void {
  injectPulseKeyframes()
  el.classList.add(PULSE_CLASS)
  setTimeout(() => {
    el.classList.remove(PULSE_CLASS)
  }, durationMs)
}

function injectPulseKeyframes(): void {
  if (document.getElementById(PULSE_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = PULSE_STYLE_ID
  style.textContent = `
@keyframes feedback-pulse-ring {
  0%   { box-shadow: 0 0 0 0px rgba(251, 146, 60, 0.6); }
  70%  { box-shadow: 0 0 0 10px rgba(251, 146, 60, 0); }
  100% { box-shadow: 0 0 0 0px rgba(251, 146, 60, 0); }
}
@media (prefers-reduced-motion: reduce) {
  .${PULSE_CLASS} { outline: 2px solid #fb923c !important; }
}
.${PULSE_CLASS} {
  animation: feedback-pulse-ring 1.2s ease-out;
  outline: 2px solid #fb923c;
  outline-offset: 2px;
}
`
  document.head.appendChild(style)
}
