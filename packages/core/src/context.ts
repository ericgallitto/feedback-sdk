import type { ElementContext } from '@ericgallitto/feedback-contract'

export type { ElementContext }

/**
 * Build a human-readable breadcrumb by walking up the DOM.
 * Uses data-feedback-label, aria-label, card headings, or tag semantics.
 * e.g. "Settings > Billing > Change Plan button"
 */
export function buildBreadcrumb(el: HTMLElement): string {
  const crumbs: string[] = []
  let current: HTMLElement | null = el

  while (current && current !== document.body) {
    const label =
      current.getAttribute('data-feedback-label') ??
      current.getAttribute('aria-label')

    if (label) {
      crumbs.unshift(label)
    } else if (current.matches('main')) {
      break
    } else {
      const heading = getDirectHeading(current)
      if (heading && !crumbs.includes(heading)) {
        crumbs.unshift(heading)
      }
    }
    current = current.parentElement
  }

  if (crumbs.length === 0) {
    const text = el.textContent?.trim().slice(0, 60)
    if (text) crumbs.push(text)
  }

  return crumbs.slice(0, 5).join(' > ') || '(unknown element)'
}

function getDirectHeading(el: HTMLElement): string | null {
  const h = el.querySelector(':scope > h1, :scope > h2, :scope > h3, :scope > h4')
  const text = h?.textContent?.trim()
  return text && text.length <= 80 ? text : null
}

/** Infer a semantic element type label for agent consumption. */
export function inferElementType(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase()
  if (tag === 'button' || el.getAttribute('role') === 'button') return 'button'
  if (tag === 'a') return 'link'
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return 'input'
  if (tag === 'table' || tag === 'thead' || tag === 'tbody') return 'table'
  if (tag === 'form') return 'form'
  if (tag === 'nav') return 'nav'
  if (tag === 'img' || tag === 'svg') return 'image'
  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) return 'heading'
  if (el.classList.contains('card') || el.closest('[class*="card"]') === el) return 'card'
  if (el.closest('[class*="badge"]') === el) return 'badge'
  if (el.closest('[class*="chart"]') === el) return 'chart'
  if (tag === 'section' || tag === 'article') return 'section'
  if (tag === 'p' || tag === 'span' || tag === 'label') return 'text'
  return 'section'
}

/** Find the nearest section or card heading above the element. */
export function findSectionHeading(el: HTMLElement): string | null {
  const card = el.closest('[class*="card"], section, [role="region"]')
  if (card) {
    const h = card.querySelector('h1, h2, h3, h4, [class*="CardTitle"]')
    const text = h?.textContent?.trim()
    if (text && text.length <= 100) return text
  }
  return null
}

/** Grab visible text near the element for context. Truncated to 300 chars. */
export function captureSurroundingText(el: HTMLElement): string | null {
  const parent =
    el.closest('[class*="card"], section, [role="region"], tr, li') ??
    el.parentElement
  if (!parent) return null
  const text = parent.textContent?.replace(/\s+/g, ' ').trim().slice(0, 300)
  return text ?? null
}

/** Check for any active tab in the current page. */
export function findActiveTab(): string | null {
  const activeTab = document.querySelector(
    '[role="tab"][aria-selected="true"], [data-state="active"][role="tab"], button[class*="tab"][aria-selected="true"]',
  )
  return activeTab?.textContent?.trim() ?? null
}

/**
 * Extract route params from a pathname.
 * e.g. /admin/cohorts/abc-123 → { entity: "cohorts", id: "abc-123" }
 */
export function extractRouteParams(pathname: string): Record<string, string> {
  const parts = pathname.split('/').filter(Boolean)
  const params: Record<string, string> = {}
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (!part) continue
    if (part.length > 20 || /^[0-9a-f-]{36}$/i.test(part)) {
      params['id'] = part
      const entity = parts[i - 1]
      if (i > 0 && entity) params['entity'] = entity
    }
  }
  return params
}

/**
 * Capture structured element context at the moment of user interaction.
 * This is the main entry point for widget integrations.
 */
export function captureElementContext(
  el: HTMLElement,
  pathname: string,
  userRole: string | null,
): ElementContext {
  return {
    breadcrumb: buildBreadcrumb(el),
    elementType: inferElementType(el),
    sectionHeading: findSectionHeading(el),
    surroundingText: captureSurroundingText(el),
    viewportContext: {
      role: userRole,
      pathname,
      route_params: extractRouteParams(pathname),
      active_tab: findActiveTab(),
      viewport_width: window.innerWidth,
      scroll_y: Math.round(window.scrollY),
      timestamp: new Date().toISOString(),
    },
  }
}
