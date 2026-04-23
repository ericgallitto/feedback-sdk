#!/usr/bin/env node
import * as p from '@clack/prompts'
import { randomBytes } from 'crypto'
import { writeFileSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'

const TOOLS = [
  { value: 'cursor', label: 'Cursor', hint: 'adds to .cursor/mcp.json' },
  { value: 'claude-code', label: 'Claude Code', hint: 'adds to .claude/mcp.json' },
  { value: 'windsurf', label: 'Windsurf', hint: 'adds to .windsurf/mcp.json' },
  { value: 'cline', label: 'Cline (VS Code)', hint: 'adds to .vscode/cline_mcp_settings.json' },
  { value: 'copilot', label: 'GitHub Copilot Chat', hint: 'shows manual setup instructions' },
  { value: 'manual', label: 'Other / show me the JSON', hint: 'prints to console' },
] as const

type ToolValue = typeof TOOLS[number]['value']

const STORES = [
  { value: 'memory', label: 'In-memory (demo only — resets on restart)' },
  { value: 'sqlite', label: 'SQLite file (persistent, zero config)' },
] as const

type StoreValue = typeof STORES[number]['value']

function makeMcpConfig(serverPath: string, store: StoreValue, sqlitePath?: string): Record<string, unknown> {
  const env: Record<string, string> = { FEEDBACK_STORE: store }
  if (store === 'sqlite' && sqlitePath) env['FEEDBACK_SQLITE_PATH'] = sqlitePath
  return {
    mcpServers: {
      'feedback-sdk': {
        command: 'node',
        args: [serverPath],
        env,
      },
    },
  }
}

function mergeJson(filePath: string, patch: Record<string, unknown>): void {
  let base: Record<string, unknown> = {}
  if (existsSync(filePath)) {
    try { base = JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, unknown> }
    catch { /* ignore parse error, overwrite */ }
  }
  const merged = deepMerge(base, patch)
  writeFileSync(filePath, JSON.stringify(merged, null, 2) + '\n', 'utf8')
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target }
  for (const [k, v] of Object.entries(source)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && typeof result[k] === 'object' && result[k] !== null) {
      result[k] = deepMerge(result[k] as Record<string, unknown>, v as Record<string, unknown>)
    } else {
      result[k] = v
    }
  }
  return result
}

async function main(): Promise<void> {
  console.clear()
  p.intro('feedback-sdk setup wizard')

  const tool = await p.select({
    message: 'Which coding tool do you use?',
    options: TOOLS.map((t) => ({ value: t.value, label: t.label, hint: t.hint })),
  }) as ToolValue | symbol

  if (p.isCancel(tool)) { p.cancel('Setup cancelled.'); process.exit(0) }

  const store = await p.select({
    message: 'How do you want to store feedback?',
    options: STORES.map((s) => ({ value: s.value, label: s.label })),
  }) as StoreValue | symbol

  if (p.isCancel(store)) { p.cancel('Setup cancelled.'); process.exit(0) }

  let sqlitePath: string | undefined
  if (store === 'sqlite') {
    const answer = await p.text({
      message: 'SQLite file path?',
      placeholder: './feedback.db',
      defaultValue: './feedback.db',
    }) as string | symbol
    if (p.isCancel(answer)) { p.cancel('Setup cancelled.'); process.exit(0) }
    sqlitePath = answer
  }

  const publishableKey = `pk_${randomBytes(16).toString('hex')}`
  const secretKey = `sk_${randomBytes(24).toString('hex')}`

  // Resolve the MCP server binary path (relative to this script at runtime)
  const serverPath = new URL('../../integrations/mcp/dist/server.js', import.meta.url).pathname

  const config = makeMcpConfig(serverPath, store, sqlitePath)
  const configJson = JSON.stringify(config, null, 2)

  const s = p.spinner()
  s.start('Writing config…')

  const cwd = process.cwd()

  switch (tool) {
    case 'cursor': {
      const dest = join(cwd, '.cursor', 'mcp.json')
      mergeJson(dest, config)
      s.stop(`✅ Written to ${dest}`)
      break
    }
    case 'claude-code': {
      const dest = join(cwd, '.claude', 'mcp.json')
      mergeJson(dest, config)
      s.stop(`✅ Written to ${dest}`)
      break
    }
    case 'windsurf': {
      const dest = join(cwd, '.windsurf', 'mcp.json')
      mergeJson(dest, config)
      s.stop(`✅ Written to ${dest}`)
      break
    }
    case 'cline': {
      const dest = join(cwd, '.vscode', 'cline_mcp_settings.json')
      mergeJson(dest, config)
      s.stop(`✅ Written to ${dest}`)
      break
    }
    case 'copilot':
    case 'manual':
    default: {
      s.stop('Here is your MCP config:')
      console.log('\n' + configJson + '\n')
      break
    }
  }

  const envBlock = [
    `FEEDBACK_PUBLISHABLE_KEY=${publishableKey}`,
    `FEEDBACK_SECRET_KEY=${secretKey}`,
    store === 'sqlite' ? `FEEDBACK_SQLITE_PATH=${sqlitePath ?? './feedback.db'}` : null,
  ].filter(Boolean).join('\n')

  p.note(
    `Add these to your .env (keep the secret key private):\n\n${envBlock}`,
    'Environment variables',
  )

  const embedSnippet = `import { FeedbackWidget } from '@ericgallitto/feedback-react'

// Place this anywhere in your app tree:
<FeedbackWidget
  onSubmit={async (input) => {
    const res = await fetch('http://localhost:3210/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Feedback-Key': process.env.FEEDBACK_PUBLISHABLE_KEY,
      },
      body: JSON.stringify(input),
    })
    return res.json()
  }}
  identity={currentUser ? { userId: currentUser.id, email: currentUser.email } : null}
/>`

  p.note(embedSnippet, 'Widget embed snippet')

  p.outro(`You're all set! Start the MCP server with: npx @ericgallitto/feedback-mcp`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
