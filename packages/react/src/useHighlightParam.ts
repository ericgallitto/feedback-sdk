import { useEffect } from 'react'
import { scrollToSelector, pulseElement, applyHighlight, clearAllHighlights } from '@ericgallitto/feedback-core'
import type { UseHighlightParamOptions } from './types.js'

/**
 * Router-agnostic deep-link highlight hook.
 * Reads ?highlight=<selector> (or "highlight") via the caller-supplied getter,
 * scrolls the matching element into view, and pulses it.
 *
 * Usage with React Router:
 *   const [searchParams] = useSearchParams()
 *   useHighlightParam({ getSearchParam: (k) => searchParams.get(k) })
 *
 * Usage without a router:
 *   useHighlightParam({ getSearchParam: (k) => new URLSearchParams(location.search).get(k) })
 */
export function useHighlightParam({ getSearchParam }: UseHighlightParamOptions): void {
  const selector = getSearchParam('highlight')

  useEffect(() => {
    if (!selector) return

    clearAllHighlights()

    // Slight delay to let the page render before scrolling
    const timer = setTimeout(() => {
      const el = scrollToSelector(selector, 'smooth')
      if (!el) return

      applyHighlight(el)
      pulseElement(el, 1400)

      // Remove highlight after pulse
      setTimeout(() => clearAllHighlights(), 1600)
    }, 120)

    return () => clearTimeout(timer)
  }, [selector])
}
