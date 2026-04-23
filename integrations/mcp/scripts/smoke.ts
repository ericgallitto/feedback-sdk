/**
 * MCP smoke test — spawns an in-process server, connects a client via InMemoryTransport,
 * then exercises all four tools against a memory store.
 *
 * Exit 0 on pass, exit 1 on any failure.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createMcpServer } from '../src/server.js'
import { createMemoryStore } from '@ericgallitto/feedback-api'

function assert(condition: boolean, msg: string): asserts condition {
  if (!condition) {
    console.error(`✗ FAIL: ${msg}`)
    process.exit(1)
  }
}

async function run(): Promise<void> {
  const store = createMemoryStore()
  const server = createMcpServer(store)

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()

  const client = new Client({ name: 'smoke-test', version: '0.0.1' }, { capabilities: {} })
  await server.connect(serverTransport)
  await client.connect(clientTransport)

  // ── 1. list_tools ───────────────────────────────────────────────────────────
  const { tools } = await client.listTools()
  const toolNames = new Set(tools.map((t) => t.name))
  assert(toolNames.has('list_feedback'), 'list_feedback tool must be registered')
  assert(toolNames.has('get_feedback'), 'get_feedback tool must be registered')
  assert(toolNames.has('update_feedback'), 'update_feedback tool must be registered')
  assert(toolNames.has('summarize_feedback'), 'summarize_feedback tool must be registered')
  console.log('  ✓ all 4 tools registered')

  // ── 2. Seed a record via the store directly ─────────────────────────────────
  const record = await store.create({
    page_url: 'https://smoke.example.com',
    category: 'bug',
    comment: 'Smoke test feedback item',
    user_email: 'smoke@test.com',
  })

  // ── 3. list_feedback ────────────────────────────────────────────────────────
  const listResult = await client.callTool({ name: 'list_feedback', arguments: {} })
  const listContent = listResult.content as Array<{ type: string; text: string }>
  assert(listContent[0]?.type === 'text', 'list_feedback content must be text')
  const items = JSON.parse(listContent[0].text) as Array<{ id: string }>
  assert(items.length === 1, `list_feedback must return 1 item, got ${items.length}`)
  assert(items[0].id === record.id, 'list_feedback must return the seeded record id')
  console.log('  ✓ list_feedback returned the seeded record')

  // ── 4. get_feedback ─────────────────────────────────────────────────────────
  const getResult = await client.callTool({ name: 'get_feedback', arguments: { id: record.id } })
  const getContent = getResult.content as Array<{ type: string; text: string }>
  const fetched = JSON.parse(getContent[0].text) as { id: string; status: string }
  assert(fetched.id === record.id, 'get_feedback must return the correct record id')
  assert(fetched.status === 'new', 'get_feedback record status must be new')
  console.log('  ✓ get_feedback returned correct record')

  // ── 5. update_feedback ──────────────────────────────────────────────────────
  const updateResult = await client.callTool({
    name: 'update_feedback',
    arguments: { id: record.id, status: 'reviewed', agent_summary: 'Smoke test summary' },
  })
  const updateContent = updateResult.content as Array<{ type: string; text: string }>
  const updated = JSON.parse(updateContent[0].text) as { status: string; agent_summary: string }
  assert(updated.status === 'reviewed', 'update_feedback must persist status change')
  assert(updated.agent_summary === 'Smoke test summary', 'update_feedback must persist agent_summary')
  console.log('  ✓ update_feedback persisted status + agent_summary')

  // ── 6. summarize_feedback ───────────────────────────────────────────────────
  const sumResult = await client.callTool({ name: 'summarize_feedback', arguments: {} })
  const sumContent = sumResult.content as Array<{ type: string; text: string }>
  const summary = JSON.parse(sumContent[0].text) as { total: number; byStatus: Record<string, number> }
  assert(summary.total === 1, `summarize_feedback total must be 1, got ${summary.total}`)
  assert(summary.byStatus['reviewed'] === 1, 'summarize_feedback must reflect updated status')
  console.log('  ✓ summarize_feedback returned correct counts')

  // ── 7. get_feedback on missing id ───────────────────────────────────────────
  const missingResult = await client.callTool({ name: 'get_feedback', arguments: { id: 'ghost-id' } })
  const missingText = (missingResult.content as Array<{ type: string; text: string }>)[0].text
  assert(missingText.includes('No feedback found'), 'get_feedback on missing id must say not found')
  console.log('  ✓ get_feedback on missing id returns not-found message')

  await client.close()
  console.log('\n✓ MCP smoke test passed')
}

run().catch((err) => {
  console.error('✗ MCP smoke test threw:', err)
  process.exit(1)
})
