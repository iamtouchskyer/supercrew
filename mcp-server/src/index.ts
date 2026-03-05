#!/usr/bin/env bun

import { createDb, getDefaultDbPath } from './store/db.js'
import { FeatureStore } from './store/feature-store.js'
import { EventBus } from './events/event-bus.js'
import { BranchScanner } from './scanner/branch-scanner.js'
import { startMcpServer } from './mcp/server.js'

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

  // Start MCP server
  await startMcpServer(store, eventBus)
}

main().catch(console.error)
