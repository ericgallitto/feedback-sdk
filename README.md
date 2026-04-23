# feedback-sdk

**On-site, element-anchored feedback with two standard ways to connect: MCP and HTTP/OpenAPI.**

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)

---

## What is this?

A small control on your website lets people **point at a specific part of the page** and describe what's wrong or missing — not just a generic "contact us" box.

The system **remembers the page, the element's address in the page, nearby text, and a category** in a consistent shape of data. That shape makes the next step possible:

**Software can act on it without you copying and pasting.** Examples: *"turn these 20 items into a grouped summary"*, *"suggest a fix list"*, *"hand this to the coding tool I already use."*

There are **two doors into the same data**:

| Door | Best for | How it works |
|------|----------|-------------|
| **MCP** | Cursor, Claude Code, Windsurf, Cline, Copilot Chat | AI coding tools subscribe to feedback as a built-in data source |
| **HTTP + OpenAPI + webhooks** | n8n, Make, Zapier, custom servers | POST to ingest, receive signed webhooks on create/status change |

You don't need both. Pick the one that fits how you already work.

---

## Human-in-the-loop by default

Feedback never silently becomes a production deploy. Every item moves through stages:

```
captured → triaged → plan_approved → in_progress → code_review → ship_approved → shipped → closed
```

Humans approve at `plan_approved` and `ship_approved`. Agents help at every other stage.

---

## Quick start

### 1. Run the setup wizard

```bash
npx @ericgallitto/feedback-sdk-setup
```

The wizard asks: which coding tool you use, which store you want, and writes the right MCP config file for your tool. Takes under 2 minutes.

### 2. Embed the widget

```tsx
import { FeedbackWidget } from '@ericgallitto/feedback-react'

<FeedbackWidget
  onSubmit={async (input) => {
    const res = await fetch('http://localhost:3210/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    return res.json()
  }}
  identity={user ? { userId: user.id, email: user.email } : null}
/>
```

### 3. Start the server

```bash
# In-memory (demo):
FEEDBACK_DEMO_MODE=true npx @ericgallitto/feedback-api

# Persistent SQLite:
FEEDBACK_STORE=sqlite FEEDBACK_SQLITE_PATH=./feedback.db npx @ericgallitto/feedback-api
```

### 4. Connect your coding tool

The wizard wrote the config for you. Restart your editor and the `feedback-sdk` MCP server appears automatically.

---

## Which door should I use?

| I want to… | Use |
|-----------|-----|
| Ask my AI coding assistant "what feedback is waiting?" | **MCP** |
| Trigger a Slack message when new feedback arrives | **Webhook** |
| Query feedback from n8n or Make | **HTTP + OpenAPI** |
| Build a custom dashboard | **HTTP** |
| Use both at the same time | Both — they share the same store |

---

## Packages

| Package | Description |
|---------|-------------|
| [`@ericgallitto/feedback-contract`](packages/contract/) | Versioned TypeScript types, JSON Schema, OpenAPI 3.1 spec |
| [`@ericgallitto/feedback-core`](packages/core/) | Framework-agnostic DOM utilities (element context, highlight, deeplink) |
| [`@ericgallitto/feedback-react`](packages/react/) | React widget + `useHighlightParam` + `DeepLinkProvider` |
| [`@ericgallitto/feedback-storage-sqlite`](packages/storage-sqlite/) | SQLite adapter — persistent, zero config |
| [`@ericgallitto/feedback-api`](integrations/api/) | Hono HTTP server + OpenAPI + outbound signed webhooks |
| [`@ericgallitto/feedback-mcp`](integrations/mcp/) | MCP server: `list_feedback`, `get_feedback`, `update_feedback`, `summarize_feedback` |

---

## MCP tools reference

Once connected, your coding tool can use:

| Tool | What it does |
|------|-------------|
| `list_feedback` | List items. Filter by `status`, `category`, `page`, `pipeline_state`. |
| `get_feedback` | Get one item by ID. |
| `update_feedback` | Update `status`, `priority`, `pipeline_state`, `admin_notes`, `agent_summary`, `agent_tags`. |
| `summarize_feedback` | Counts by status / category / pipeline state + 5 most recent unreviewed items. |

---

## HTTP API reference

See [`packages/contract/openapi.json`](packages/contract/openapi.json) for the full OpenAPI 3.1 spec.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/feedback` | Publishable key | Submit new feedback |
| `GET` | `/feedback` | Secret key | List with filters |
| `GET` | `/feedback/:id` | Secret key | Get one item |
| `PATCH` | `/feedback/:id` | Secret key | Update status / pipeline |
| `DELETE` | `/feedback/:id` | Secret key | Delete item |
| `GET` | `/healthz` | None | Health check |

### Webhook signatures

All outbound webhooks include `X-Feedback-Signature: t=<unix_ts>,v1=<hmac_sha256>`.

Verify in Node:
```ts
import { createHmac } from 'crypto'
function verify(body: string, sig: string, secret: string): boolean {
  const [tPart, v1Part] = sig.split(',')
  const ts = tPart?.split('=')[1] ?? ''
  const expected = createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex')
  return v1Part === `v1=${expected}`
}
```

---

## FeedbackWidget props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `onSubmit` | `(input: FeedbackInput) => Promise<FeedbackRecord>` | ✅ | Persist the record and return it |
| `identity` | `FeedbackIdentity \| null` | — | Signed-in user. If null, `anonymous` mode activates |
| `anonymous` | `boolean` | — | Show email input for unauthenticated users |
| `pageNameResolver` | `(pathname: string) => string` | — | Map routes to human labels |
| `categories` | `FeedbackCategoryOption[]` | — | Override the default categories |
| `theme` | `FeedbackTheme` | — | CSS variable overrides + extra class names |
| `triggerSlot` | `(props: { onClick }) => ReactNode` | — | Replace the default floating button |
| `onSuccess` | `(record: FeedbackRecord) => void` | — | Called after successful submit |
| `onError` | `(error: Error) => void` | — | Called on submit failure |

---

## Deep-link highlights

Link to a specific element with `?highlight=<css-selector>`:

```
https://yourapp.com/settings?highlight=%23billing-section
```

With React Router:
```tsx
import { DeepLinkProvider } from '@ericgallitto/feedback-react'
const [sp] = useSearchParams()
<DeepLinkProvider getSearchParam={(k) => sp.get(k)}>
  <App />
</DeepLinkProvider>
```

---

## Storage adapters

| Adapter | Import | When to use |
|---------|--------|-------------|
| In-memory | `createMemoryStore()` from `@ericgallitto/feedback-api` | Tests, demos |
| SQLite | `createSqliteStore(path)` from `@ericgallitto/feedback-storage-sqlite` | Single-server production |
| Supabase | See [docs/adapters/supabase.md](docs/adapters/supabase.md) | Multi-tenant, hosted |

---

## Development

```bash
git clone https://github.com/ericgallitto/feedback-sdk
cd feedback-sdk
corepack enable
pnpm install
pnpm build          # build all packages
pnpm typecheck      # typecheck all packages
```

Run the Next.js demo:
```bash
# Terminal 1 — feedback API
cd examples/next-demo && pnpm api

# Terminal 2 — Next.js
cd examples/next-demo && pnpm dev
# → http://localhost:3000
```

---

## License

[MIT](LICENSE) — Eric Gallitto 2026
