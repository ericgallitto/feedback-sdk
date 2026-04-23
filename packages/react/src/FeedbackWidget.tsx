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
  applyHighlight,
  removeHighlight,
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

function DefaultTrigger({ onClick }: { onClick: () => void }): ReactNode {
  return (
    <button
      onClick={onClick}
      aria-label="Open feedback widget"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        background: 'var(--feedback-trigger-bg, #18181b)',
        color: 'var(--feedback-trigger-color, #fff)',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
        zIndex: 'var(--feedback-z-trigger, 9998)' as CSSValue,
        fontSize: '22px',
        transition: 'transform 150ms ease',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.06)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = '' }}
    >
      💬
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
  useEffect(() => {
    if (!isHighlighting) return

    function handleClick(e: MouseEvent): void {
      e.preventDefault()
      e.stopPropagation()
      const target = e.target as HTMLElement
      setSelectedElement({
        selector: buildSelector(target),
        label: findFeedbackLabel(target),
        context: captureElementContext(target, pathname, null),
      })
      setIsHighlighting(false)
      setIsOpen(true)
    }

    function handleMouseOver(e: MouseEvent): void {
      applyHighlight(e.target as HTMLElement)
    }

    function handleMouseOut(e: MouseEvent): void {
      removeHighlight(e.target as HTMLElement)
    }

    document.addEventListener('click', handleClick, true)
    document.addEventListener('mouseover', handleMouseOver)
    document.addEventListener('mouseout', handleMouseOut)

    return () => {
      document.removeEventListener('click', handleClick, true)
      document.removeEventListener('mouseover', handleMouseOver)
      document.removeEventListener('mouseout', handleMouseOut)
      clearAllHighlights()
    }
  }, [isHighlighting, pathname])

  const handleClose = useCallback((): void => {
    setIsOpen(false)
    setIsHighlighting(false)
    clearAllHighlights()
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
      autoCloseRef.current = setTimeout(() => {
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
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 'var(--feedback-z-overlay, 9999)' as CSSValue,
          cursor: 'crosshair',
          background: 'rgba(0,0,0,0.08)',
        }}
        onClick={handleClose}
        aria-label="Cancel element selection — click to close"
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
          Click any element to attach feedback — press Esc to cancel
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
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>✅</div>
            <p style={{ fontWeight: 600, fontSize: '15px', margin: 0 }}>Thanks for your feedback!</p>
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

            {/* Element target indicator */}
            {selectedElement.label || selectedElement.selector ? (
              <div style={{
                background: 'var(--feedback-tag-bg, #f4f4f5)',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '12px',
                color: 'var(--feedback-tag-color, #52525b)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <span>📌 {selectedElement.label ?? selectedElement.selector}</span>
                <button
                  onClick={() => setSelectedElement({ selector: null, label: null, context: null })}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', padding: '0 0 0 8px' }}
                  aria-label="Remove element target"
                >
                  ×
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setIsOpen(false); setIsHighlighting(true) }}
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
