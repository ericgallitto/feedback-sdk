import {
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import type { FeedbackInput, FeedbackCategory } from '@ericgallitto/feedback-contract'
import {
  captureElementContext,
  buildSelector,
  findFeedbackLabel,
  resolveTarget,
  markHover,
  clearHover,
  markSelected,
  clearSelected,
  clearAllHighlights,
} from '@ericgallitto/feedback-core'
import type { FeedbackWidgetProps, FeedbackCategoryOption } from './types.js'

const DEFAULT_CATEGORIES: FeedbackCategoryOption[] = [
  { value: 'bug', label: 'Bug' },
  { value: 'ui_suggestion', label: 'UI Suggestion' },
  { value: 'missing_feature', label: 'Missing Feature' },
  { value: 'confusing', label: 'Confusing' },
  { value: 'general', label: 'General' },
]

/**
 * The default trigger: the word "feedback" set in a monospace face.
 *
 * It used to be a speech-balloon emoji in a circle. Emoji render differently on
 * every platform, carry a tone most products do not want, and say nothing to a
 * screen reader beyond their own name. A word is unambiguous, and monospace
 * reads as an instrument rather than a chat bubble.
 *
 * Override it entirely with the triggerSlot prop.
 */
function DefaultTrigger({ onClick }: { onClick: () => void }): ReactNode {
  return (
    <button
      onClick={onClick}
      aria-label="Give feedback on this page"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        padding: '9px 15px',
        borderRadius: 'var(--feedback-trigger-radius, 8px)',
        background: 'var(--feedback-trigger-bg, #18181b)',
        color: 'var(--feedback-trigger-color, #fff)',
        border: 'none',
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
        zIndex: 'var(--feedback-z-trigger, 9998)' as CSSValue,
        fontFamily: 'var(--feedback-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
        fontSize: 'var(--feedback-trigger-size, 12px)',
        letterSpacing: '0.04em',
        lineHeight: 1,
        transition: 'opacity 150ms ease',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.88' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '' }}
    >
      feedback
    </button>
  )
}

// Workaround: TS complains about CSS custom properties in style objects
type CSSValue = string & Record<never, never>

export function FeedbackWidget({
  onSubmit,
  pageNameResolver,
  identity,
  categories = DEFAULT_CATEGORIES,
  theme,
  anonymous = false,
  triggerSlot,
  onSuccess,
  onError,
}: FeedbackWidgetProps): ReactNode {
  const [isOpen, setIsOpen] = useState(false)
  const [isHighlighting, setIsHighlighting] = useState(false)
  const [selectedElement, setSelectedElement] = useState<{
    selector: string | null
    label: string | null
    context: ReturnType<typeof captureElementContext> | null
  }>({ selector: null, label: null, context: null })
  const [category, setCategory] = useState<FeedbackCategory>('general')
  const [comment, setComment] = useState('')
  const [anonymousEmail, setAnonymousEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const autoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const pathname = typeof window !== 'undefined' ? window.location.pathname : ''
  const pageName = pageNameResolver ? pageNameResolver(pathname) : pathname

  // ── Element picker ──────────────────────────────────────────────────────────
  //
  // The overlay is pointer-events: none, so the cursor reaches the page
  // underneath and `event.target` is the element the person is actually
  // pointing at. It used to be pointer-events: auto, which meant every mouse
  // event landed on the overlay itself, and the picker highlighted and selected
  // the overlay rather than anything on the page.
  //
  // Hover is tracked as a single current element rather than by adding on
  // mouseover and removing on mouseout. Those events bubble, so crossing from a
  // parent into a child fired both and the outline flickered.
  useEffect(() => {
    if (!isHighlighting) return

    // Never let the picker target its own UI.
    const isOwn = (el: Element | null): boolean => !!el?.closest('[data-feedback-ui]')

    function pick(target: HTMLElement): void {
      setSelectedElement({
        selector: buildSelector(target),
        label: findFeedbackLabel(target),
        context: captureElementContext(target, pathname, null),
      })
      clearHover()
      // Hold the outline on the chosen element while the composer is open, so
      // the person can see what they attached their words to.
      markSelected(target)
      setIsHighlighting(false)
      setIsOpen(true)
    }

    function handleClick(e: MouseEvent): void {
      const raw = e.target as HTMLElement
      if (isOwn(raw)) return
      const target = resolveTarget(raw)
      // Capture phase: stop the page's own handlers from firing. Clicking a
      // link to describe it should not navigate away from it.
      e.preventDefault()
      e.stopPropagation()
      pick(target)
    }

    function handleMove(e: MouseEvent): void {
      const raw = e.target as HTMLElement
      // Highlight what would actually be recorded, not the deepest node the
      // cursor happens to sit over.
      markHover(isOwn(raw) ? null : resolveTarget(raw))
    }

    function handleKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault()
        clearHover()
        setIsHighlighting(false)
        // Return to the composer rather than discarding what was typed.
        setIsOpen(true)
        return
      }
      // Keyboard route to the same outcome, for anyone not using a mouse.
      if (e.key === 'Enter' || e.key === ' ') {
        const el = document.activeElement as HTMLElement | null
        if (el && el !== document.body && !isOwn(el)) {
          e.preventDefault()
          pick(resolveTarget(el))
        }
      }
    }

    document.addEventListener('click', handleClick, true)
    document.addEventListener('mousemove', handleMove, true)
    window.addEventListener('keydown', handleKey, true)

    return () => {
      document.removeEventListener('click', handleClick, true)
      document.removeEventListener('mousemove', handleMove, true)
      window.removeEventListener('keydown', handleKey, true)
      // Only the hover marker. The selection is the point of the exercise and
      // has to survive leaving picking mode.
      clearHover()
    }
  }, [isHighlighting, pathname])

  // Highlight colours have to reach the document root.
  //
  // Every other theme variable is set on the widget's own portal, which is
  // correct: they style the panel and the trigger. The highlight variables are
  // different. They style elements out on the page, which are not inside the
  // portal, so a value set there never cascades to them and the outline silently
  // falls back to its default no matter what the host passes in.
  //
  // Anything named --feedback-highlight* is promoted to documentElement and
  // removed again on unmount.
  useEffect(() => {
    const vars = theme?.vars
    if (!vars) return
    const promoted = Object.entries(vars).filter(([k]) => k.startsWith('--feedback-highlight'))
    if (promoted.length === 0) return
    const root = document.documentElement
    for (const [k, v] of promoted) root.style.setProperty(k, v)
    return () => { for (const [k] of promoted) root.style.removeProperty(k) }
  }, [theme])

  const handleClose = useCallback((): void => {
    setIsOpen(false)
    setIsHighlighting(false)
    clearAllHighlights()
  }, [])

  /** Go back to the page and pick something else, keeping what has been typed. */
  const handleReselect = useCallback((): void => {
    clearSelected()
    setSelectedElement({ selector: null, label: null, context: null })
    setIsOpen(false)
    setIsHighlighting(true)
  }, [])

  /** Detach from any element without leaving the composer. */
  const handleClearTarget = useCallback((): void => {
    clearSelected()
    setSelectedElement({ selector: null, label: null, context: null })
  }, [])

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!comment.trim()) return

    const ctx = selectedElement.context

    // Build identity fields
    let identityFields: Partial<FeedbackInput> = {}
    if (identity) {
      if ('userId' in identity && identity.userId) {
        identityFields = {
          user_id: identity.userId,
          user_name: identity.name ?? null,
          ...(identity.email ? { user_email: identity.email } : {}),
        }
      } else if ('email' in identity && identity.email) {
        identityFields = {
          user_email: identity.email,
          user_name: identity.name ?? null,
        }
      }
    } else if (anonymous && anonymousEmail) {
      identityFields = { user_email: anonymousEmail }
    }

    const input: FeedbackInput = {
      ...identityFields,
      page_url: typeof window !== 'undefined' ? window.location.href : '',
      page_name: pageName || null,
      element_selector: selectedElement.selector ?? null,
      element_label: selectedElement.label ?? null,
      element_breadcrumb: ctx?.breadcrumb ?? null,
      element_type: ctx?.elementType ?? null,
      section_heading: ctx?.sectionHeading ?? null,
      surrounding_text: ctx?.surroundingText ?? null,
      viewport_context: ctx?.viewportContext ?? {},
      category,
      comment: comment.trim(),
    } as FeedbackInput

    setIsSubmitting(true)
    try {
      const record = await onSubmit(input)
      setSubmitted(true)
      onSuccess?.(record)
      // The outline stays up through the confirmation, so the last thing seen
      // is the element the words were attached to.
      autoCloseRef.current = setTimeout(() => {
        clearSelected()
        setIsOpen(false)
        setSubmitted(false)
        setComment('')
        setSelectedElement({ selector: null, label: null, context: null })
        setCategory('general')
        setAnonymousEmail('')
      }, 2500)
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setIsSubmitting(false)
    }
  }, [comment, category, selectedElement, identity, anonymous, anonymousEmail, pageName, onSubmit, onSuccess, onError])

  // Cleanup timer on unmount
  useEffect(() => () => {
    if (autoCloseRef.current) clearTimeout(autoCloseRef.current)
  }, [])

  // ── Keyboard: close on Escape ───────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, handleClose])

  const themeStyle: Record<string, string> = theme?.vars ?? {}

  // ── Render trigger ──────────────────────────────────────────────────────────
  if (isHighlighting) {
    return createPortal(
      <div
        data-feedback-ui=""
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 'var(--feedback-z-overlay, 9999)' as CSSValue,
          // Critical: the cursor has to reach the page underneath, or every
          // mouse event lands here and the picker targets the overlay.
          pointerEvents: 'none',
          // A wash would sit over the element being highlighted and mute it.
          background: 'transparent',
        }}
      >
        <div style={{
          position: 'fixed',
          top: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#18181b',
          color: '#fff',
          padding: '10px 20px',
          borderRadius: '999px',
          fontSize: '14px',
          fontWeight: 500,
          pointerEvents: 'none',
        }}>
          Click the part of the page you want to talk about. Esc to go back.
        </div>
      </div>,
      document.body,
    )
  }

  const trigger = triggerSlot
    ? triggerSlot({ onClick: () => setIsOpen(true) })
    : <DefaultTrigger onClick={() => setIsOpen(true)} />

  if (!isOpen) {
    return createPortal(<>{trigger}</>, document.body)
  }

  return createPortal(
    <div
      className={theme?.className}
      data-feedback-ui=""
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--feedback-z-overlay, 9999)' as CSSValue,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'flex-end',
        padding: '24px',
        pointerEvents: 'none',
        ...themeStyle,
      }}
    >
      {/* Backdrop */}
      <div
        style={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-label="Submit feedback"
        aria-modal="true"
        style={{
          position: 'relative',
          background: 'var(--feedback-panel-bg, #fff)',
          borderRadius: 'var(--feedback-panel-radius, 16px)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          width: '360px',
          maxWidth: '100%',
          padding: '24px',
          pointerEvents: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          fontFamily: 'var(--feedback-font, system-ui, sans-serif)',
        }}
      >
        {submitted ? (
          <div style={{ padding: '8px 0' }}>
            <p style={{ fontWeight: 600, fontSize: '15px', margin: 0 }}>Sent. Thank you.</p>
            <p style={{ fontSize: '13px', margin: '6px 0 0', color: 'var(--feedback-muted, #71717a)' }}>
              Recorded with the part of the page you pointed at.
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Share feedback</h2>
              <button
                onClick={handleClose}
                aria-label="Close feedback widget"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', lineHeight: 1, padding: '2px' }}
              >
                ×
              </button>
            </div>

            {/* What this feedback is attached to. The same element is outlined
                on the page behind the composer for as long as this shows. */}
            {selectedElement.label || selectedElement.selector ? (
              <div style={{
                background: 'var(--feedback-tag-bg, #f4f4f5)',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '12px',
                color: 'var(--feedback-tag-color, #52525b)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}>
                <span style={{
                  fontFamily: 'var(--feedback-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
                  fontSize: '11px',
                  wordBreak: 'break-word',
                }}>
                  {selectedElement.label ?? selectedElement.selector}
                </span>
                <span style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={handleReselect}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                      fontSize: '11px', textDecoration: 'underline', color: 'inherit', font: 'inherit',
                    }}
                  >
                    Pick a different one
                  </button>
                  <button
                    onClick={handleClearTarget}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                      fontSize: '11px', textDecoration: 'underline', color: 'inherit', font: 'inherit',
                    }}
                  >
                    Detach
                  </button>
                </span>
              </div>
            ) : (
              <button
                onClick={handleReselect}
                style={{
                  background: 'var(--feedback-tag-bg, #f4f4f5)',
                  border: '1px dashed var(--feedback-border, #d4d4d8)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  fontSize: '12px',
                  color: 'var(--feedback-muted, #71717a)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                + Point at an element (optional)
              </button>
            )}

            {/* Category */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500 }}>Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
                style={{
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--feedback-border, #d4d4d8)',
                  fontSize: '14px',
                  background: 'var(--feedback-input-bg, #fff)',
                }}
              >
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* Comment */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500 }}>
                What do you want to share?
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Describe what you noticed…"
                rows={4}
                style={{
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid var(--feedback-border, #d4d4d8)',
                  fontSize: '14px',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  background: 'var(--feedback-input-bg, #fff)',
                  lineHeight: 1.5,
                }}
              />
            </div>

            {/* Anonymous email */}
            {anonymous && !identity && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500 }}>Your email (required)</label>
                <input
                  type="email"
                  value={anonymousEmail}
                  onChange={(e) => setAnonymousEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={{
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid var(--feedback-border, #d4d4d8)',
                    fontSize: '14px',
                    background: 'var(--feedback-input-bg, #fff)',
                  }}
                />
              </div>
            )}

            {/* Submit */}
            <button
              onClick={() => void handleSubmit()}
              disabled={isSubmitting || !comment.trim() || (anonymous && !identity && !anonymousEmail)}
              style={{
                background: 'var(--feedback-submit-bg, #18181b)',
                color: 'var(--feedback-submit-color, #fff)',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 16px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: isSubmitting ? 'wait' : 'pointer',
                opacity: isSubmitting ? 0.7 : 1,
                transition: 'opacity 150ms ease',
              }}
            >
              {isSubmitting ? 'Sending…' : 'Send feedback'}
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
