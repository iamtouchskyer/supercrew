import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createTools } from './tools.js'
import type { FeatureStore } from '../store/feature-store.js'
import type { EventBus } from '../events/event-bus.js'

export async function startMcpServer(store: FeatureStore, eventBus: EventBus) {
  const server = new McpServer(
    { name: 'supercrew-mcp', version: '0.1.0' },
    { capabilities: {} }
  )

  const tools = createTools(store, eventBus)

  // Register all tools
  for (const [name, tool] of Object.entries(tools)) {
    server.registerTool(name, {
      description: tool.description,
      inputSchema: tool.inputSchema,
    }, tool.handler)
  }

  const transport = new StdioServerTransport()
  await server.connect(transport)

  console.error('SuperCrew MCP Server running on stdio')
  return server
}
