#!/usr/bin/env node
import { serve } from '@hono/node-server'
import { createApp, type AppConfig } from './app.js'
import { createMemoryStore } from './memory-store.js'
import type { FeedbackStore } from '@ericgallitto/feedback-contract'

async function main(): Promise<void> {
  const storeType = process.env['FEEDBACK_STORE'] ?? 'memory'
  const port = parseInt(process.env['FEEDBACK_PORT'] ?? '3210', 10)

  let store: FeedbackStore

  if (storeType === 'sqlite') {
    const sqlitePath = process.env['FEEDBACK_SQLITE_PATH'] ?? './feedback.db'
    // Dynamic import keeps the binary dep optional when running in-memory
    const { createSqliteStore } = await import('@ericgallitto/feedback-storage-sqlite')
    store = createSqliteStore(sqlitePath)
  } else {
    store = createMemoryStore()
  }

  const publishableKey = process.env['FEEDBACK_PUBLISHABLE_KEY']
  const secretKey = process.env['FEEDBACK_SECRET_KEY']
  const demoMode = process.env['FEEDBACK_DEMO_MODE'] === 'true'
  const webhookUrl = process.env['FEEDBACK_WEBHOOK_URL']
  const webhookSecret = process.env['FEEDBACK_WEBHOOK_SECRET'] ?? ''

  const config: AppConfig = {
    store,
    demoMode,
    webhooks: webhookUrl ? [{ url: webhookUrl, secret: webhookSecret }] : [],
    ...(publishableKey ? { publishableKey } : {}),
    ...(secretKey ? { secretKey } : {}),
  }

  const app = createApp(config)

  serve({ fetch: app.fetch, port }, () => {
    console.log(`[feedback-api] listening on http://localhost:${port}`)
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
