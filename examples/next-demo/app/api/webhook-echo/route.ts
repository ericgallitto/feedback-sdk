import { NextRequest, NextResponse } from 'next/server'
import type { FeedbackWebhookEvent } from '@ericgallitto/feedback-contract'

/**
 * Stub webhook receiver — logs incoming events so you can see the loop working.
 * In a real deployment, this route would trigger a build pipeline, send a Slack
 * message, create a GitHub issue, etc.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const sig = req.headers.get('X-Feedback-Signature') ?? '(none)'

  let event: FeedbackWebhookEvent
  try {
    event = await req.json() as FeedbackWebhookEvent
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // In dev, just log to the Next.js server console
  console.log('\n[webhook-echo] received:', event.event)
  console.log('  signature:', sig)
  console.log('  id:', event.data.id)
  console.log('  status:', event.data.status)
  console.log('  pipeline:', event.data.pipeline_state)
  console.log()

  return NextResponse.json({ received: true })
}
