import type { FeedbackInput, FeedbackRecord, FeedbackCategory } from '@ericgallitto/feedback-contract'
import type { ReactNode, CSSProperties } from 'react'

export type { FeedbackInput, FeedbackRecord }

export interface FeedbackCategoryOption {
  value: FeedbackCategory
  label: string
}

export interface FeedbackTheme {
  /** CSS var overrides applied to the widget root element. */
  vars?: Record<string, string>
  /** Additional class name(s) added to the widget root. */
  className?: string
}

/**
 * Identity supplied by the host app.
 * Either userId or email must be present.
 */
export type FeedbackIdentity =
  | { userId: string; email?: string | null; name?: string | null }
  | { userId?: null; email: string; name?: string | null }

export interface FeedbackWidgetProps {
  /** Called when the user submits feedback. Must persist the record and return it. */
  onSubmit: (input: FeedbackInput) => Promise<FeedbackRecord>

  /** Resolve a pathname to a human-readable page label. */
  pageNameResolver?: (pathname: string) => string

  /** Signed-in user identity. If null/undefined, anonymous submit path activates. */
  identity?: FeedbackIdentity | null

  /** Override the default category options. */
  categories?: FeedbackCategoryOption[]

  /** CSS variable overrides and/or extra class names for theming. */
  theme?: FeedbackTheme

  /** When true, renders an email input for unauthenticated users instead of blocking. */
  anonymous?: boolean

  /** Replace the default floating trigger button. Receives onClick to open the widget. */
  triggerSlot?: (props: { onClick: () => void }) => ReactNode

  /** Callback fired after successful submission. */
  onSuccess?: (record: FeedbackRecord) => void

  /** Callback fired on submission error. */
  onError?: (error: Error) => void
}

export interface DeepLinkProviderProps {
  /**
   * Returns the current value of a URL search param.
   * Provide this to decouple from any specific router.
   * e.g. (key) => new URLSearchParams(window.location.search).get(key)
   */
  getSearchParam: (key: string) => string | null
  children: ReactNode
}

export interface UseHighlightParamOptions {
  getSearchParam: (key: string) => string | null
}
