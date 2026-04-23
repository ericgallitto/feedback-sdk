import { useEffect, type ReactNode } from 'react'
import { scrollToSelector, pulseElement, clearAllHighlights } from '@ericgallitto/feedback-core'
import type { DeepLinkProviderProps } from './types.js'

/**
 * Drop this anywhere in your React tree to enable ?highlight= deep-linking.
 * It is router-agnostic: pass `getSearchParam` that reads from your router's search params.
 *
 * @example
 * // With React Router v6:
 * const [sp] = useSearchParams()
 * <DeepLinkProvider getSearchParam={(k) => sp.get(k)}>
 *   {children}
 * </DeepLinkProvider>
 */
export function DeepLinkProvider({ getSearchParam, children }: DeepLinkProviderProps): ReactNode {
  const selector = getSearchParam('highlight')

  useEffect(() => {
    if (!selector) return
    clearAllHighlights()
    const timer = setTimeout(() => {
      const el = scrollToSelector(selector, 'smooth')
      if (!el) return
      pulseElement(el, 1400)
    }, 120)
    return () => clearTimeout(timer)
  }, [selector])

  return <>{children}</>
}
