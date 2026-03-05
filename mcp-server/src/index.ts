#!/usr/bin/env bun

import { createDb, getDefaultDbPath } from './store/db.js'
import { FeatureStore } from './store/feature-store.js'
import { EventBus } from './events/event-bus.js'
import { BranchScanner } from './scanner/branch-scanner.js'
import { startMcpServer } from './mcp/server.js'
import { createHttpApp } from './http/routes.js'
import { WebSocketServer } from './ws/server.js'

const HTTP_PORT = parseInt(process.env.MCP_HTTP_PORT ?? '3456')
const WS_PORT = parseInt(process.env.MCP_WS_PORT ?? '3457')

async function main() {
  const repoRoot = process.cwd()
  const dbPath = getDefaultDbPath(repoRoot)

  // Ensure .supercrew directory exists
  const { mkdirSync } = await import('fs')
  mkdirSync(`${repoRoot}/.supercrew`, { recursive: true })

  const db = createDb(dbPath)
  const store = new FeatureStore(db)
  const eventBus = new EventBus()
  const scanner = new BranchScanner(repoRoot)

  // Initial scan
  console.error('Scanning branches for features...')
  const { features } = await scanner.scanAllBranches()
  for (const feature of features) {
    store.upsertFromGitHub(feature)
  }
  console.error(`Loaded ${features.length} features from ${repoRoot}`)

  // Check if running in MCP mode (stdin connected from Claude Code)
  const isMcpMode = !process.stdin.isTTY

  if (isMcpMode) {
    // MCP Server mode (Claude Code)
    await startMcpServer(store, eventBus)
  } else {
    // HTTP + WebSocket mode (Web UI)
    const httpApp = createHttpApp(store, eventBus)
    const wsServer = new WebSocketServer(eventBus)

    // HTTP Server
    Bun.serve({
      port: HTTP_PORT,
      fetch: httpApp.fetch,
    })
    console.error(`HTTP server running on http://localhost:${HTTP_PORT}`)

    // WebSocket Server
    Bun.serve({
      port: WS_PORT,
      fetch(req, server) {
        if (server.upgrade(req)) return
        return new Response('WebSocket upgrade required', { status: 426 })
      },
      websocket: {
        open(ws) {
          // Bun's ServerWebSocket is compatible with WebSocket interface
          wsServer.handleConnection(ws as unknown as WebSocket)
        },
        message() {},
        close() {},
      },
    })
    console.error(`WebSocket server running on ws://localhost:${WS_PORT}`)

    // Periodic rescan every 30 seconds
    setInterval(async () => {
      const { features: newFeatures } = await scanner.scanAllBranches()
      for (const f of newFeatures) {
        store.upsertFromGitHub(f)
      }
    }, 30000)
  }
}

main().catch(console.error)
