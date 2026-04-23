'use client'

import { FeedbackWidget } from '@ericgallitto/feedback-react'
import type { FeedbackInput } from '@ericgallitto/feedback-contract'

export function FeedbackWidgetWrapper() {
  async function handleSubmit(input: FeedbackInput) {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string }
      throw new Error(err.error ?? `HTTP ${res.status}`)
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return res.json()
  }

  return (
    <FeedbackWidget
      onSubmit={handleSubmit}
      anonymous={true}
      pageNameResolver={(pathname) => {
        if (pathname === '/') return 'Home'
        return pathname
      }}
    />
  )
}
