# Contributing

Thanks for your interest in contributing to feedback-sdk!

## Setup

```bash
git clone https://github.com/ericgallitto/feedback-sdk
cd feedback-sdk
corepack enable
pnpm install
pnpm build
```

## Development

```bash
pnpm dev          # watch mode across all packages
pnpm typecheck    # TypeScript check
pnpm test         # run all tests
pnpm lint         # ESLint
```

## Package structure

| Package | Description |
|---------|-------------|
| `packages/contract` | Shared types, JSON Schema, OpenAPI spec |
| `packages/core` | Headless DOM utilities (no framework dependency) |
| `packages/react` | React widget and hooks |
| `packages/storage-sqlite` | SQLite storage adapter |
| `integrations/api` | HTTP server (Hono) + outbound webhooks |
| `integrations/mcp` | MCP server |
| `examples/next-demo` | End-to-end Next.js demo |
| `examples/cli-setup-wizard` | Interactive setup CLI |

## Pull requests

- One concern per PR
- All packages must pass `pnpm typecheck` and `pnpm test`
- Keep commit messages clear and imperative ("Add webhook signing", not "Added webhook signing")

## Code of conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
