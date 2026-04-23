import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { FeedbackWidgetWrapper } from './components/FeedbackWidgetWrapper'

export const metadata: Metadata = {
  title: 'feedback-sdk demo',
  description: 'End-to-end demo of @ericgallitto/feedback-sdk',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#fafaf9' }}>
        {children}
        <FeedbackWidgetWrapper />
      </body>
    </html>
  )
}
