import type { FeedbackWebhookEvent } from '@ericgallitto/feedback-contract'
import { createHmac } from 'crypto'

export interface WebhookConfig {
  url: string
  secret: string
}

/** Build the X-Feedback-Signature header value: `t=<unix_ts>,v1=<hex_hmac>` */
export function signWebhook(payload: string, secret: string): string {
  const ts = Math.floor(Date.now() / 1000).toString()
  const hmac = createHmac('sha256', secret)
    .update(`${ts}.${payload}`)
    .digest('hex')
  return `t=${ts},v1=${hmac}`
}

/**
 * Deliver a webhook event to all configured endpoints.
 * Failures are logged but do not throw — delivery is best-effort.
 */
export async function deliverWebhooks(
  configs: WebhookConfig[],
  event: FeedbackWebhookEvent,
): Promise<void> {
  if (configs.length === 0) return

  const body = JSON.stringify(event)

  await Promise.allSettled(
    configs.map(async (cfg) => {
      const sig = signWebhook(body, cfg.secret)
      try {
        const res = await fetch(cfg.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Feedback-Signature': sig,
          },
          body,
        })
        if (!res.ok) {
          console.warn(`[feedback-api] webhook delivery failed: ${res.status} ${cfg.url}`)
        }
      } catch (err) {
        console.warn(`[feedback-api] webhook delivery error: ${cfg.url}`, err)
      }
    }),
  )
}
