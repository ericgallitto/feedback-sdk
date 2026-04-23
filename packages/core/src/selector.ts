/**
 * Build a unique, stable CSS selector for an element.
 * Prefers #id when available; otherwise walks up the DOM building
 * a structural path like `section > div:nth-child(2) > button`.
 */
export function buildSelector(el: HTMLElement): string {
  if (el.id) return `#${el.id}`

  const parts: string[] = []
  let current: HTMLElement | null = el

  while (current && current !== document.body) {
    const part = getSelectorPart(current)
    parts.unshift(part)

    // Stop once the partial path is already unique
    const candidate = parts.join(' > ')
    if (document.querySelectorAll(candidate).length === 1) {
      return candidate.slice(0, 300)
    }

    current = current.parentElement
  }

  return parts.join(' > ').slice(0, 300) || el.tagName.toLowerCase()
}

function getSelectorPart(el: HTMLElement): string {
  if (el.id) return `#${el.id}`

  const tag = el.tagName.toLowerCase()
  const parent = el.parentElement

  if (!parent) return tag

  // Check if the tag alone is unique among siblings
  const siblings = Array.from(parent.children).filter(
    (c) => c.tagName === el.tagName,
  )

  if (siblings.length === 1) return tag

  const index = siblings.indexOf(el) + 1
  return `${tag}:nth-of-type(${index})`
}

/**
 * Walk up the DOM looking for the nearest data-feedback-label attribute.
 * Falls back to the nearest heading text.
 */
export function findFeedbackLabel(el: HTMLElement): string | null {
  let current: HTMLElement | null = el
  while (current) {
    const label = current.getAttribute('data-feedback-label')
    if (label) return label
    current = current.parentElement
  }
  const heading = el
    .closest('section, [class*="card"], div')
    ?.querySelector('h1, h2, h3, h4')
  return heading?.textContent?.trim() ?? null
}
