# SuperCrew MCP Server Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a local MCP Server that enables real-time bidirectional sync between Web UI and Claude Code, with GitHub as backup.

**Architecture:** MCP Server runs locally (per-repo instance), stores features in SQLite for fast read/write, syncs to GitHub asynchronously. Claude Code connects via MCP Protocol, Web UI connects via WebSocket. Branch Scanner aggregates features from all branches.

**Tech Stack:** TypeScript, Bun, SQLite (better-sqlite3), MCP SDK (@modelcontextprotocol/sdk), WebSocket (ws), Hono (HTTP API)

**Design Doc:** [2026-03-05-mcp-server-design.md](./2026-03-05-mcp-server-design.md)

---

## Phase 1: MCP Server 基础 + SQLite + Feature Store

### Task 1.1: 创建 MCP Server 项目结构

**Files:**
- Create: `mcp-server/package.json`
- Create: `mcp-server/tsconfig.json`
- Create: `mcp-server/src/index.ts`

**Step 1: 创建目录结构**

```bash
mkdir -p mcp-server/src
```

**Step 2: 创建 package.json**

```json
{
  "name": "@supercrew/mcp-server",
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.ts",
  "bin": {
    "supercrew-mcp": "./src/index.ts"
  },
  "scripts": {
    "dev": "bun run --watch src/index.ts",
    "start": "bun run src/index.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "better-sqlite3": "^11.0.0",
    "hono": "^4.12.3",
    "ws": "^8.18.0",
    "gray-matter": "^4.0.3",
    "js-yaml": "^4.1.1",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.11",
    "@types/bun": "latest",
    "@types/ws": "^8.5.12",
    "vitest": "^3.2.4",
    "typescript": "^5.0.0"
  }
}
```

**Step 3: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "types": ["bun-types"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 4: 创建入口文件 src/index.ts**

```typescript
#!/usr/bin/env bun

console.log('SuperCrew MCP Server starting...')

// Placeholder - will be implemented in subsequent tasks
export {}
```

**Step 5: 安装依赖**

Run: `cd mcp-server && bun install`

**Step 6: 验证启动**

Run: `cd mcp-server && bun run src/index.ts`
Expected: "SuperCrew MCP Server starting..."

**Step 7: Commit**

```bash
git add mcp-server/
git commit -m "feat(mcp-server): initialize project structure"
```

---

### Task 1.2: 实现 SQLite Feature Store

**Files:**
- Create: `mcp-server/src/store/db.ts`
- Create: `mcp-server/src/store/feature-store.ts`
- Create: `mcp-server/src/types.ts`
- Test: `mcp-server/src/__tests__/feature-store.test.ts`

**Step 1: 创建类型定义 src/types.ts**

```typescript
export type SupercrewStatus =
  | 'planning'
  | 'designing'
  | 'ready'
  | 'active'
  | 'blocked'
  | 'done'

export type Priority = 'P0' | 'P1' | 'P2' | 'P3'

export interface Feature {
  id: string
  title: string
  status: SupercrewStatus
  owner: string | null
  priority: Priority | null
  branch: string
  teams: string[]
  tags: string[]
  blocked_by: string[]
  target_release: string | null
  created_at: string
  updated_at: string
  meta_yaml: string | null
  design_md: string | null
  plan_md: string | null
  log_md: string | null
  synced_at: string | null
}

export interface FeatureInput {
  id: string
  title: string
  status?: SupercrewStatus
  owner?: string
  priority?: Priority
  branch?: string
  teams?: string[]
  tags?: string[]
}
```

**Step 2: 创建数据库初始化 src/store/db.ts**

```typescript
import Database from 'better-sqlite3'
import { join } from 'path'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS features (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planning',
  owner TEXT,
  priority TEXT,
  branch TEXT NOT NULL DEFAULT 'main',
  teams TEXT DEFAULT '[]',
  tags TEXT DEFAULT '[]',
  blocked_by TEXT DEFAULT '[]',
  target_release TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  meta_yaml TEXT,
  design_md TEXT,
  plan_md TEXT,
  log_md TEXT,
  synced_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_features_status ON features(status);
CREATE INDEX IF NOT EXISTS idx_features_branch ON features(branch);
`

export function createDb(dbPath: string): Database.Database {
  const db = new Database(dbPath)
  db.exec(SCHEMA)
  return db
}

export function getDefaultDbPath(repoRoot: string): string {
  return join(repoRoot, '.supercrew', '.mcp-server.db')
}
```

**Step 3: 创建 Feature Store src/store/feature-store.ts**

```typescript
import type Database from 'better-sqlite3'
import type { Feature, FeatureInput, SupercrewStatus } from '../types.js'

export class FeatureStore {
  constructor(private db: Database.Database) {}

  listAll(): Feature[] {
    const rows = this.db.prepare('SELECT * FROM features ORDER BY updated_at DESC').all()
    return rows.map(this.rowToFeature)
  }

  get(id: string): Feature | null {
    const row = this.db.prepare('SELECT * FROM features WHERE id = ?').get(id)
    return row ? this.rowToFeature(row) : null
  }

  create(input: FeatureInput): Feature {
    const now = new Date().toISOString()
    const feature: Feature = {
      id: input.id,
      title: input.title,
      status: input.status ?? 'planning',
      owner: input.owner ?? null,
      priority: input.priority ?? null,
      branch: input.branch ?? 'main',
      teams: input.teams ?? [],
      tags: input.tags ?? [],
      blocked_by: [],
      target_release: null,
      created_at: now,
      updated_at: now,
      meta_yaml: null,
      design_md: null,
      plan_md: null,
      log_md: null,
      synced_at: null,
    }

    this.db.prepare(`
      INSERT INTO features (id, title, status, owner, priority, branch, teams, tags, blocked_by, target_release, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      feature.id,
      feature.title,
      feature.status,
      feature.owner,
      feature.priority,
      feature.branch,
      JSON.stringify(feature.teams),
      JSON.stringify(feature.tags),
      JSON.stringify(feature.blocked_by),
      feature.target_release,
      feature.created_at,
      feature.updated_at
    )

    return feature
  }

  updateStatus(id: string, status: SupercrewStatus): Feature | null {
    const now = new Date().toISOString()
    this.db.prepare('UPDATE features SET status = ?, updated_at = ? WHERE id = ?').run(status, now, id)
    return this.get(id)
  }

  updatePlan(id: string, content: string): Feature | null {
    const now = new Date().toISOString()
    this.db.prepare('UPDATE features SET plan_md = ?, updated_at = ? WHERE id = ?').run(content, now, id)
    return this.get(id)
  }

  appendLog(id: string, entry: string): Feature | null {
    const feature = this.get(id)
    if (!feature) return null

    const now = new Date().toISOString()
    const timestamp = now.split('T')[0]
    const newEntry = `\n## ${timestamp}\n\n${entry}\n`
    const newLog = (feature.log_md ?? '') + newEntry

    this.db.prepare('UPDATE features SET log_md = ?, updated_at = ? WHERE id = ?').run(newLog, now, id)
    return this.get(id)
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM features WHERE id = ?').run(id)
    return result.changes > 0
  }

  upsertFromGitHub(feature: Feature): void {
    const existing = this.get(feature.id)
    if (existing) {
      this.db.prepare(`
        UPDATE features SET
          title = ?, status = ?, owner = ?, priority = ?, branch = ?,
          teams = ?, tags = ?, blocked_by = ?, target_release = ?,
          meta_yaml = ?, design_md = ?, plan_md = ?, log_md = ?,
          updated_at = ?, synced_at = ?
        WHERE id = ?
      `).run(
        feature.title, feature.status, feature.owner, feature.priority, feature.branch,
        JSON.stringify(feature.teams), JSON.stringify(feature.tags), JSON.stringify(feature.blocked_by),
        feature.target_release, feature.meta_yaml, feature.design_md, feature.plan_md, feature.log_md,
        feature.updated_at, new Date().toISOString(), feature.id
      )
    } else {
      this.db.prepare(`
        INSERT INTO features (id, title, status, owner, priority, branch, teams, tags, blocked_by, target_release, created_at, updated_at, meta_yaml, design_md, plan_md, log_md, synced_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        feature.id, feature.title, feature.status, feature.owner, feature.priority, feature.branch,
        JSON.stringify(feature.teams), JSON.stringify(feature.tags), JSON.stringify(feature.blocked_by),
        feature.target_release, feature.created_at, feature.updated_at,
        feature.meta_yaml, feature.design_md, feature.plan_md, feature.log_md, new Date().toISOString()
      )
    }
  }

  private rowToFeature(row: any): Feature {
    return {
      ...row,
      teams: JSON.parse(row.teams ?? '[]'),
      tags: JSON.parse(row.tags ?? '[]'),
      blocked_by: JSON.parse(row.blocked_by ?? '[]'),
    }
  }
}
```

**Step 4: 创建测试目录和测试文件**

```bash
mkdir -p mcp-server/src/__tests__
```

**Step 5: 创建 feature-store.test.ts**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { FeatureStore } from '../store/feature-store.js'
import { createDb } from '../store/db.js'

describe('FeatureStore', () => {
  let db: Database.Database
  let store: FeatureStore

  beforeEach(() => {
    db = createDb(':memory:')
    store = new FeatureStore(db)
  })

  afterEach(() => {
    db.close()
  })

  it('creates and retrieves a feature', () => {
    const feature = store.create({
      id: 'test-feature',
      title: 'Test Feature',
      status: 'planning',
      owner: 'alice',
    })

    expect(feature.id).toBe('test-feature')
    expect(feature.title).toBe('Test Feature')
    expect(feature.status).toBe('planning')
    expect(feature.owner).toBe('alice')

    const retrieved = store.get('test-feature')
    expect(retrieved).not.toBeNull()
    expect(retrieved!.id).toBe('test-feature')
  })

  it('lists all features', () => {
    store.create({ id: 'f1', title: 'Feature 1' })
    store.create({ id: 'f2', title: 'Feature 2' })

    const all = store.listAll()
    expect(all.length).toBe(2)
  })

  it('updates feature status', () => {
    store.create({ id: 'f1', title: 'Feature 1', status: 'planning' })

    const updated = store.updateStatus('f1', 'active')
    expect(updated!.status).toBe('active')
  })

  it('appends to log', () => {
    store.create({ id: 'f1', title: 'Feature 1' })

    const updated = store.appendLog('f1', 'Started implementation')
    expect(updated!.log_md).toContain('Started implementation')
  })

  it('deletes a feature', () => {
    store.create({ id: 'f1', title: 'Feature 1' })

    const deleted = store.delete('f1')
    expect(deleted).toBe(true)
    expect(store.get('f1')).toBeNull()
  })
})
```

**Step 6: 运行测试验证失败**

Run: `cd mcp-server && bun test`
Expected: Tests should fail (files not created yet)

**Step 7: 创建所有文件后运行测试**

Run: `cd mcp-server && bun test`
Expected: All tests pass

**Step 8: Commit**

```bash
git add mcp-server/src/
git commit -m "feat(mcp-server): add SQLite feature store with CRUD operations"
```

---

### Task 1.3: 实现 Event Bus

**Files:**
- Create: `mcp-server/src/events/event-bus.ts`
- Test: `mcp-server/src/__tests__/event-bus.test.ts`

**Step 1: 创建 event-bus.ts**

```typescript
import { EventEmitter } from 'events'
import type { Feature } from '../types.js'

export type FeatureEvent =
  | { type: 'feature:created'; feature: Feature }
  | { type: 'feature:updated'; feature: Feature }
  | { type: 'feature:deleted'; featureId: string }
  | { type: 'sync:started' }
  | { type: 'sync:completed'; count: number }
  | { type: 'conflict:detected'; featureId: string; local: Feature; remote: Feature }

export class EventBus extends EventEmitter {
  emit(event: FeatureEvent['type'], ...args: any[]): boolean {
    return super.emit(event, ...args)
  }

  on(event: FeatureEvent['type'], listener: (...args: any[]) => void): this {
    return super.on(event, listener)
  }

  featureCreated(feature: Feature): void {
    this.emit('feature:created', feature)
  }

  featureUpdated(feature: Feature): void {
    this.emit('feature:updated', feature)
  }

  featureDeleted(featureId: string): void {
    this.emit('feature:deleted', featureId)
  }

  conflictDetected(featureId: string, local: Feature, remote: Feature): void {
    this.emit('conflict:detected', featureId, local, remote)
  }
}

export const eventBus = new EventBus()
```

**Step 2: 创建 event-bus.test.ts**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { EventBus } from '../events/event-bus.js'
import type { Feature } from '../types.js'

describe('EventBus', () => {
  it('emits feature:created event', () => {
    const bus = new EventBus()
    const handler = vi.fn()

    bus.on('feature:created', handler)

    const feature: Feature = {
      id: 'test',
      title: 'Test',
      status: 'planning',
      owner: null,
      priority: null,
      branch: 'main',
      teams: [],
      tags: [],
      blocked_by: [],
      target_release: null,
      created_at: '2026-03-05',
      updated_at: '2026-03-05',
      meta_yaml: null,
      design_md: null,
      plan_md: null,
      log_md: null,
      synced_at: null,
    }

    bus.featureCreated(feature)

    expect(handler).toHaveBeenCalledWith(feature)
  })

  it('emits conflict:detected event', () => {
    const bus = new EventBus()
    const handler = vi.fn()

    bus.on('conflict:detected', handler)

    const local = { id: 'f1' } as Feature
    const remote = { id: 'f1' } as Feature

    bus.conflictDetected('f1', local, remote)

    expect(handler).toHaveBeenCalledWith('f1', local, remote)
  })
})
```

**Step 3: 运行测试**

Run: `cd mcp-server && bun test`
Expected: All tests pass

**Step 4: Commit**

```bash
git add mcp-server/src/events/
git commit -m "feat(mcp-server): add event bus for real-time notifications"
```

---

### Task 1.4: 实现 Branch Scanner

**Files:**
- Create: `mcp-server/src/scanner/branch-scanner.ts`
- Create: `mcp-server/src/scanner/feature-parser.ts`
- Test: `mcp-server/src/__tests__/branch-scanner.test.ts`

**Step 1: 创建 feature-parser.ts**

```typescript
import matter from 'gray-matter'
import yaml from 'js-yaml'
import type { Feature, SupercrewStatus, Priority } from '../types.js'

export function parseMetaYaml(content: string, featureId: string): Partial<Feature> {
  const data = yaml.load(content) as Record<string, any>
  return {
    id: data.id ?? featureId,
    title: data.title ?? '',
    status: (data.status ?? 'planning') as SupercrewStatus,
    owner: data.owner ?? null,
    priority: data.priority as Priority ?? null,
    teams: data.teams ?? [],
    tags: data.tags ?? [],
    blocked_by: data.blocked_by ?? [],
    target_release: data.target_release ?? null,
    created_at: data.created ?? new Date().toISOString(),
    updated_at: data.updated ?? new Date().toISOString(),
    meta_yaml: content,
  }
}

export function parseDesignMd(content: string): { body: string } {
  const { content: body } = matter(content)
  return { body: body.trim() }
}

export function parsePlanMd(content: string): { body: string; total: number; completed: number } {
  const { data, content: body } = matter(content)
  return {
    body: body.trim(),
    total: data.total_tasks ?? 0,
    completed: data.completed_tasks ?? 0,
  }
}
```

**Step 2: 创建 branch-scanner.ts**

```typescript
import { execSync } from 'child_process'
import { join } from 'path'
import { existsSync, readFileSync } from 'fs'
import type { Feature } from '../types.js'
import { parseMetaYaml } from './feature-parser.js'

export interface ScanResult {
  features: Feature[]
  branches: string[]
}

export class BranchScanner {
  constructor(private repoRoot: string) {}

  async scanAllBranches(): Promise<ScanResult> {
    const branches = this.listBranches()
    const featuresPerBranch = new Map<string, Feature[]>()

    for (const branch of branches) {
      const features = await this.scanBranch(branch)
      featuresPerBranch.set(branch, features)
    }

    const deduped = this.dedupeFeatures(featuresPerBranch)
    return { features: deduped, branches }
  }

  async scanCurrentBranch(): Promise<Feature[]> {
    const branch = this.getCurrentBranch()
    return this.scanBranch(branch)
  }

  private listBranches(): string[] {
    try {
      const output = execSync('git branch -a --format="%(refname:short)"', {
        cwd: this.repoRoot,
        encoding: 'utf-8',
      })
      return output
        .split('\n')
        .map(b => b.trim())
        .filter(b => b && !b.includes('->'))
        .filter(b => b === 'main' || b.startsWith('feature/') || b.startsWith('fix/'))
    } catch {
      return ['main']
    }
  }

  private getCurrentBranch(): string {
    try {
      return execSync('git branch --show-current', {
        cwd: this.repoRoot,
        encoding: 'utf-8',
      }).trim()
    } catch {
      return 'main'
    }
  }

  private async scanBranch(branch: string): Promise<Feature[]> {
    const featuresDir = join(this.repoRoot, '.supercrew', 'features')

    if (!existsSync(featuresDir)) {
      return []
    }

    const features: Feature[] = []

    try {
      // For current branch, read from filesystem
      const currentBranch = this.getCurrentBranch()
      if (branch === currentBranch) {
        const entries = Bun.file(featuresDir).name ? [] :
          Array.from(new Bun.Glob('*').scanSync(featuresDir))

        for (const entry of entries) {
          const featurePath = join(featuresDir, entry)
          const feature = this.parseFeatureDir(featurePath, entry, branch)
          if (feature) features.push(feature)
        }
      } else {
        // For other branches, use git show
        const featureIds = this.listFeaturesInBranch(branch)
        for (const id of featureIds) {
          const feature = this.parseFeatureFromGit(branch, id)
          if (feature) features.push(feature)
        }
      }
    } catch (e) {
      console.error(`Error scanning branch ${branch}:`, e)
    }

    return features
  }

  private listFeaturesInBranch(branch: string): string[] {
    try {
      const output = execSync(
        `git ls-tree -d --name-only ${branch}:.supercrew/features/ 2>/dev/null || true`,
        { cwd: this.repoRoot, encoding: 'utf-8' }
      )
      return output.split('\n').filter(Boolean)
    } catch {
      return []
    }
  }

  private parseFeatureDir(dirPath: string, featureId: string, branch: string): Feature | null {
    const metaPath = join(dirPath, 'meta.yaml')
    if (!existsSync(metaPath)) return null

    try {
      const metaContent = readFileSync(metaPath, 'utf-8')
      const partial = parseMetaYaml(metaContent, featureId)

      const designPath = join(dirPath, 'design.md')
      const planPath = join(dirPath, 'plan.md')
      const logPath = join(dirPath, 'log.md')

      return {
        ...partial,
        branch,
        design_md: existsSync(designPath) ? readFileSync(designPath, 'utf-8') : null,
        plan_md: existsSync(planPath) ? readFileSync(planPath, 'utf-8') : null,
        log_md: existsSync(logPath) ? readFileSync(logPath, 'utf-8') : null,
        synced_at: null,
      } as Feature
    } catch {
      return null
    }
  }

  private parseFeatureFromGit(branch: string, featureId: string): Feature | null {
    try {
      const metaContent = execSync(
        `git show ${branch}:.supercrew/features/${featureId}/meta.yaml 2>/dev/null`,
        { cwd: this.repoRoot, encoding: 'utf-8' }
      )
      const partial = parseMetaYaml(metaContent, featureId)

      const getFile = (filename: string): string | null => {
        try {
          return execSync(
            `git show ${branch}:.supercrew/features/${featureId}/${filename} 2>/dev/null`,
            { cwd: this.repoRoot, encoding: 'utf-8' }
          )
        } catch {
          return null
        }
      }

      return {
        ...partial,
        branch,
        design_md: getFile('design.md'),
        plan_md: getFile('plan.md'),
        log_md: getFile('log.md'),
        synced_at: null,
      } as Feature
    } catch {
      return null
    }
  }

  private dedupeFeatures(featuresPerBranch: Map<string, Feature[]>): Feature[] {
    const result = new Map<string, Feature>()

    // First add main branch features
    for (const f of featuresPerBranch.get('main') ?? []) {
      result.set(f.id, { ...f, branch: 'main' })
    }

    // Then override with feature/* and fix/* branches (more recent)
    for (const [branch, features] of featuresPerBranch) {
      if (branch.startsWith('feature/') || branch.startsWith('fix/')) {
        for (const f of features) {
          result.set(f.id, { ...f, branch })
        }
      }
    }

    return Array.from(result.values())
  }
}
```

**Step 3: 创建 branch-scanner.test.ts**

```typescript
import { describe, it, expect } from 'vitest'
import { parseMetaYaml } from '../scanner/feature-parser.js'

describe('Feature Parser', () => {
  it('parses meta.yaml correctly', () => {
    const content = `
id: login-feature
title: User Login
status: active
owner: alice
priority: P1
teams:
  - frontend
  - backend
tags:
  - auth
`
    const result = parseMetaYaml(content, 'login-feature')

    expect(result.id).toBe('login-feature')
    expect(result.title).toBe('User Login')
    expect(result.status).toBe('active')
    expect(result.owner).toBe('alice')
    expect(result.priority).toBe('P1')
    expect(result.teams).toEqual(['frontend', 'backend'])
    expect(result.tags).toEqual(['auth'])
  })

  it('uses defaults for missing fields', () => {
    const content = `
title: Minimal Feature
`
    const result = parseMetaYaml(content, 'minimal')

    expect(result.id).toBe('minimal')
    expect(result.status).toBe('planning')
    expect(result.teams).toEqual([])
  })
})
```

**Step 4: 运行测试**

Run: `cd mcp-server && bun test`
Expected: All tests pass

**Step 5: Commit**

```bash
git add mcp-server/src/scanner/
git commit -m "feat(mcp-server): add branch scanner for multi-branch feature aggregation"
```

---

## Phase 2: MCP Protocol 集成

### Task 2.1: 实现 MCP Server 入口

**Files:**
- Modify: `mcp-server/src/index.ts`
- Create: `mcp-server/src/mcp/server.ts`
- Create: `mcp-server/src/mcp/tools.ts`

**Step 1: 创建 MCP Tools 定义 src/mcp/tools.ts**

```typescript
import type { FeatureStore } from '../store/feature-store.js'
import type { EventBus } from '../events/event-bus.js'
import type { SupercrewStatus } from '../types.js'

export function createTools(store: FeatureStore, eventBus: EventBus) {
  return {
    list_features: {
      description: '列出所有 features',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const features = store.listAll()
        return { content: [{ type: 'text', text: JSON.stringify(features, null, 2) }] }
      },
    },

    get_feature: {
      description: '获取单个 feature 详情',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string', description: 'Feature ID' } },
        required: ['id'],
      },
      handler: async ({ id }: { id: string }) => {
        const feature = store.get(id)
        if (!feature) {
          return { content: [{ type: 'text', text: `Feature ${id} not found` }], isError: true }
        }
        return { content: [{ type: 'text', text: JSON.stringify(feature, null, 2) }] }
      },
    },

    create_feature: {
      description: '创建新 feature',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Feature ID (e.g., login-page)' },
          title: { type: 'string', description: 'Feature title' },
          priority: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
          owner: { type: 'string', description: 'Owner username' },
        },
        required: ['id', 'title'],
      },
      handler: async (input: { id: string; title: string; priority?: string; owner?: string }) => {
        const feature = store.create({
          id: input.id,
          title: input.title,
          priority: input.priority as any,
          owner: input.owner,
        })
        eventBus.featureCreated(feature)
        return { content: [{ type: 'text', text: `Created feature: ${feature.id}` }] }
      },
    },

    update_feature_status: {
      description: '更新 feature 状态',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          status: { type: 'string', enum: ['planning', 'designing', 'ready', 'active', 'blocked', 'done'] },
        },
        required: ['id', 'status'],
      },
      handler: async ({ id, status }: { id: string; status: SupercrewStatus }) => {
        const feature = store.updateStatus(id, status)
        if (!feature) {
          return { content: [{ type: 'text', text: `Feature ${id} not found` }], isError: true }
        }
        eventBus.featureUpdated(feature)
        return { content: [{ type: 'text', text: `Updated ${id} status to ${status}` }] }
      },
    },

    log_progress: {
      description: '追加 feature log 记录',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          entry: { type: 'string', description: 'Progress entry to append' },
        },
        required: ['id', 'entry'],
      },
      handler: async ({ id, entry }: { id: string; entry: string }) => {
        const feature = store.appendLog(id, entry)
        if (!feature) {
          return { content: [{ type: 'text', text: `Feature ${id} not found` }], isError: true }
        }
        eventBus.featureUpdated(feature)
        return { content: [{ type: 'text', text: `Added log entry to ${id}` }] }
      },
    },
  }
}
```

**Step 2: 创建 MCP Server src/mcp/server.ts**

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createTools } from './tools.js'
import type { FeatureStore } from '../store/feature-store.js'
import type { EventBus } from '../events/event-bus.js'

export async function startMcpServer(store: FeatureStore, eventBus: EventBus) {
  const server = new Server(
    { name: 'supercrew-mcp', version: '0.1.0' },
    { capabilities: { tools: {} } }
  )

  const tools = createTools(store, eventBus)

  server.setRequestHandler('tools/list', async () => ({
    tools: Object.entries(tools).map(([name, tool]) => ({
      name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  }))

  server.setRequestHandler('tools/call', async (request) => {
    const { name, arguments: args } = request.params as { name: string; arguments: any }
    const tool = tools[name as keyof typeof tools]
    if (!tool) {
      return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true }
    }
    return tool.handler(args)
  })

  const transport = new StdioServerTransport()
  await server.connect(transport)

  console.error('SuperCrew MCP Server running on stdio')
  return server
}
```

**Step 3: 更新入口文件 src/index.ts**

```typescript
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
```

**Step 4: 验证 MCP Server**

Run: `cd mcp-server && echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | bun run src/index.ts`
Expected: JSON response listing available tools

**Step 5: Commit**

```bash
git add mcp-server/src/
git commit -m "feat(mcp-server): implement MCP protocol with tools for feature management"
```

---

### Task 2.2: 添加 MCP Server 到 Claude Code 配置

**Files:**
- Modify: `plugins/supercrew/.claude-plugin/plugin.json`
- Create: `plugins/supercrew/mcp/settings.json`

**Step 1: 创建 MCP 配置模板**

```bash
mkdir -p plugins/supercrew/mcp
```

**Step 2: 创建 settings.json 模板**

```json
{
  "mcpServers": {
    "supercrew": {
      "command": "bunx",
      "args": ["@supercrew/mcp-server"],
      "env": {}
    }
  }
}
```

**Step 3: 更新 plugin.json**

```json
{
  "name": "supercrew",
  "description": "AI-driven feature lifecycle management with real-time MCP sync.",
  "version": "0.2.0",
  "author": {
    "name": "steinsz"
  },
  "homepage": "https://github.com/nicepkg/supercrew",
  "repository": "https://github.com/nicepkg/supercrew",
  "license": "MIT",
  "keywords": ["feature-management", "kanban", "lifecycle", "planning", "tracking", "mcp"],
  "mcp": {
    "server": {
      "command": "bunx",
      "args": ["@supercrew/mcp-server"]
    }
  }
}
```

**Step 4: Commit**

```bash
git add plugins/supercrew/
git commit -m "feat(supercrew): add MCP server configuration to plugin"
```

---

## Phase 3: WebSocket + HTTP API

### Task 3.1: 添加 HTTP API 和 WebSocket 服务

**Files:**
- Create: `mcp-server/src/http/server.ts`
- Create: `mcp-server/src/http/routes.ts`
- Create: `mcp-server/src/ws/server.ts`
- Modify: `mcp-server/src/index.ts`

**Step 1: 创建 HTTP 路由 src/http/routes.ts**

```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { FeatureStore } from '../store/feature-store.js'
import type { EventBus } from '../events/event-bus.js'
import type { SupercrewStatus } from '../types.js'

export function createHttpApp(store: FeatureStore, eventBus: EventBus) {
  const app = new Hono()

  app.use('*', cors({
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowHeaders: ['Content-Type'],
  }))

  app.get('/health', (c) => c.json({ ok: true }))

  app.get('/api/features', (c) => {
    const features = store.listAll()
    return c.json(features)
  })

  app.get('/api/features/:id', (c) => {
    const feature = store.get(c.req.param('id'))
    if (!feature) return c.json({ error: 'Not found' }, 404)
    return c.json(feature)
  })

  app.post('/api/features', async (c) => {
    const body = await c.req.json()
    const feature = store.create(body)
    eventBus.featureCreated(feature)
    return c.json(feature, 201)
  })

  app.patch('/api/features/:id/status', async (c) => {
    const { status } = await c.req.json() as { status: SupercrewStatus }
    const feature = store.updateStatus(c.req.param('id'), status)
    if (!feature) return c.json({ error: 'Not found' }, 404)
    eventBus.featureUpdated(feature)
    return c.json(feature)
  })

  app.delete('/api/features/:id', (c) => {
    const deleted = store.delete(c.req.param('id'))
    if (!deleted) return c.json({ error: 'Not found' }, 404)
    eventBus.featureDeleted(c.req.param('id'))
    return c.json({ ok: true })
  })

  app.get('/api/board', (c) => {
    const features = store.listAll()
    const featuresByStatus = {
      planning: features.filter(f => f.status === 'planning'),
      designing: features.filter(f => f.status === 'designing'),
      ready: features.filter(f => f.status === 'ready'),
      active: features.filter(f => f.status === 'active'),
      blocked: features.filter(f => f.status === 'blocked'),
      done: features.filter(f => f.status === 'done'),
    }
    return c.json({ features, featuresByStatus })
  })

  return app
}
```

**Step 2: 创建 HTTP Server src/http/server.ts**

```typescript
import type { Hono } from 'hono'

export function startHttpServer(app: Hono, port: number) {
  return Bun.serve({
    port,
    fetch: app.fetch,
  })
}
```

**Step 3: 创建 WebSocket Server src/ws/server.ts**

```typescript
import type { EventBus } from '../events/event-bus.js'
import type { Feature } from '../types.js'

interface WebSocketClient {
  ws: WebSocket
  send: (data: any) => void
}

export class WebSocketServer {
  private clients: Set<WebSocketClient> = new Set()

  constructor(private eventBus: EventBus) {
    this.setupEventListeners()
  }

  setupEventListeners() {
    this.eventBus.on('feature:created', (feature: Feature) => {
      this.broadcast({ type: 'feature:created', feature })
    })

    this.eventBus.on('feature:updated', (feature: Feature) => {
      this.broadcast({ type: 'feature:updated', feature })
    })

    this.eventBus.on('feature:deleted', (featureId: string) => {
      this.broadcast({ type: 'feature:deleted', featureId })
    })

    this.eventBus.on('conflict:detected', (featureId: string, local: Feature, remote: Feature) => {
      this.broadcast({ type: 'conflict:detected', featureId, local, remote })
    })
  }

  handleConnection(ws: WebSocket) {
    const client: WebSocketClient = {
      ws,
      send: (data) => ws.send(JSON.stringify(data)),
    }
    this.clients.add(client)

    ws.addEventListener('close', () => {
      this.clients.delete(client)
    })

    // Send initial connection confirmation
    client.send({ type: 'connected', clientCount: this.clients.size })
  }

  broadcast(data: any) {
    for (const client of this.clients) {
      try {
        client.send(data)
      } catch (e) {
        this.clients.delete(client)
      }
    }
  }

  get clientCount() {
    return this.clients.size
  }
}
```

**Step 4: 更新入口文件整合所有服务**

```typescript
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
  console.error(`Loaded ${features.length} features`)

  // Check if running in MCP mode (stdin connected)
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
          wsServer.handleConnection(ws as any)
        },
        message() {},
        close() {},
      },
    })
    console.error(`WebSocket server running on ws://localhost:${WS_PORT}`)

    // Periodic rescan
    setInterval(async () => {
      const { features: newFeatures } = await scanner.scanAllBranches()
      for (const f of newFeatures) {
        store.upsertFromGitHub(f)
      }
    }, 30000)
  }
}

main().catch(console.error)
```

**Step 5: 测试 HTTP API**

Run: `cd mcp-server && bun run src/index.ts &`
Run: `curl http://localhost:3456/health`
Expected: `{"ok":true}`

**Step 6: Commit**

```bash
git add mcp-server/src/
git commit -m "feat(mcp-server): add HTTP API and WebSocket for Web UI integration"
```

---

## Phase 4: GitHub Sync Worker

### Task 4.1: 实现 GitHub 同步

**Files:**
- Create: `mcp-server/src/sync/github-sync.ts`
- Create: `mcp-server/src/sync/conflict-resolver.ts`
- Test: `mcp-server/src/__tests__/github-sync.test.ts`

**Step 1: 创建 github-sync.ts**

```typescript
import { execSync } from 'child_process'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import yaml from 'js-yaml'
import type { Feature } from '../types.js'
import type { EventBus } from '../events/event-bus.js'

interface SyncTask {
  action: 'create' | 'update' | 'delete'
  feature: Feature
}

export class GitHubSyncWorker {
  private queue: SyncTask[] = []
  private syncing = false

  constructor(
    private repoRoot: string,
    private eventBus: EventBus
  ) {}

  queueCreate(feature: Feature) {
    this.queue.push({ action: 'create', feature })
    this.processQueue()
  }

  queueUpdate(feature: Feature) {
    // Dedupe: remove pending updates for same feature
    this.queue = this.queue.filter(t => t.feature.id !== feature.id)
    this.queue.push({ action: 'update', feature })
    this.processQueue()
  }

  queueDelete(feature: Feature) {
    this.queue = this.queue.filter(t => t.feature.id !== feature.id)
    this.queue.push({ action: 'delete', feature })
    this.processQueue()
  }

  async flushAll() {
    while (this.queue.length > 0) {
      await this.processQueue()
    }
  }

  private async processQueue() {
    if (this.syncing || this.queue.length === 0) return

    this.syncing = true
    this.eventBus.emit('sync:started')

    let count = 0
    while (this.queue.length > 0) {
      const task = this.queue.shift()!
      try {
        await this.executeTask(task)
        count++
      } catch (e) {
        console.error(`Sync failed for ${task.feature.id}:`, e)
      }
    }

    this.eventBus.emit('sync:completed', count)
    this.syncing = false
  }

  private async executeTask(task: SyncTask) {
    const { feature, action } = task
    const featureDir = join(this.repoRoot, '.supercrew', 'features', feature.id)

    switch (action) {
      case 'create':
      case 'update':
        mkdirSync(featureDir, { recursive: true })
        this.writeFeatureFiles(featureDir, feature)
        this.gitCommit(`feat: ${action} feature ${feature.id}`)
        break

      case 'delete':
        if (existsSync(featureDir)) {
          execSync(`rm -rf "${featureDir}"`, { cwd: this.repoRoot })
          this.gitCommit(`chore: delete feature ${feature.id}`)
        }
        break
    }
  }

  private writeFeatureFiles(dir: string, feature: Feature) {
    // meta.yaml
    const meta = {
      id: feature.id,
      title: feature.title,
      status: feature.status,
      owner: feature.owner,
      priority: feature.priority,
      teams: feature.teams,
      tags: feature.tags,
      blocked_by: feature.blocked_by,
      target_release: feature.target_release,
      created: feature.created_at,
      updated: feature.updated_at,
    }
    writeFileSync(join(dir, 'meta.yaml'), yaml.dump(meta))

    // design.md
    if (feature.design_md) {
      writeFileSync(join(dir, 'design.md'), feature.design_md)
    }

    // plan.md
    if (feature.plan_md) {
      writeFileSync(join(dir, 'plan.md'), feature.plan_md)
    }

    // log.md
    if (feature.log_md) {
      writeFileSync(join(dir, 'log.md'), feature.log_md)
    }
  }

  private gitCommit(message: string) {
    try {
      execSync('git add .supercrew/', { cwd: this.repoRoot })
      execSync(`git commit -m "${message}" --allow-empty`, { cwd: this.repoRoot })
    } catch (e) {
      // Ignore if nothing to commit
    }
  }

  async gitPush() {
    try {
      execSync('git push', { cwd: this.repoRoot })
    } catch (e) {
      console.error('Git push failed:', e)
    }
  }
}
```

**Step 2: 创建 conflict-resolver.ts**

```typescript
import type { Feature } from '../types.js'
import type { EventBus } from '../events/event-bus.js'

export interface ConflictResolution {
  featureId: string
  choice: 'local' | 'remote'
}

export class ConflictResolver {
  private pendingConflicts: Map<string, { local: Feature; remote: Feature }> = new Map()

  constructor(private eventBus: EventBus) {}

  detectConflict(local: Feature, remote: Feature): boolean {
    // Conflict if both have been updated since last sync
    if (!local.synced_at) return false

    const localUpdated = new Date(local.updated_at).getTime()
    const remoteUpdated = new Date(remote.updated_at).getTime()
    const lastSync = new Date(local.synced_at).getTime()

    return localUpdated > lastSync && remoteUpdated > lastSync
  }

  registerConflict(local: Feature, remote: Feature) {
    this.pendingConflicts.set(local.id, { local, remote })
    this.eventBus.conflictDetected(local.id, local, remote)
  }

  resolveConflict(featureId: string, choice: 'local' | 'remote'): Feature | null {
    const conflict = this.pendingConflicts.get(featureId)
    if (!conflict) return null

    this.pendingConflicts.delete(featureId)
    return choice === 'local' ? conflict.local : conflict.remote
  }

  getPendingConflicts(): string[] {
    return Array.from(this.pendingConflicts.keys())
  }
}
```

**Step 3: 创建测试**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConflictResolver } from '../sync/conflict-resolver.js'
import { EventBus } from '../events/event-bus.js'
import type { Feature } from '../types.js'

describe('ConflictResolver', () => {
  let resolver: ConflictResolver
  let eventBus: EventBus

  beforeEach(() => {
    eventBus = new EventBus()
    resolver = new ConflictResolver(eventBus)
  })

  it('detects conflict when both local and remote updated after sync', () => {
    const local: Feature = {
      id: 'f1',
      title: 'Test',
      status: 'active',
      owner: null,
      priority: null,
      branch: 'main',
      teams: [],
      tags: [],
      blocked_by: [],
      target_release: null,
      created_at: '2026-03-01T00:00:00Z',
      updated_at: '2026-03-05T10:00:00Z',
      meta_yaml: null,
      design_md: null,
      plan_md: null,
      log_md: null,
      synced_at: '2026-03-04T00:00:00Z',
    }

    const remote: Feature = {
      ...local,
      updated_at: '2026-03-05T09:00:00Z',
    }

    expect(resolver.detectConflict(local, remote)).toBe(true)
  })

  it('resolves conflict with chosen version', () => {
    const local = { id: 'f1', title: 'Local Title' } as Feature
    const remote = { id: 'f1', title: 'Remote Title' } as Feature

    resolver.registerConflict(local, remote)

    const resolved = resolver.resolveConflict('f1', 'remote')
    expect(resolved?.title).toBe('Remote Title')
    expect(resolver.getPendingConflicts()).toEqual([])
  })
})
```

**Step 4: 运行测试**

Run: `cd mcp-server && bun test`
Expected: All tests pass

**Step 5: Commit**

```bash
git add mcp-server/src/sync/
git commit -m "feat(mcp-server): add GitHub sync worker with conflict detection"
```

---

## Phase 5: 集成测试与文档

### Task 5.1: 添加集成测试

**Files:**
- Create: `mcp-server/src/__tests__/integration.test.ts`

**Step 1: 创建集成测试**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { createDb } from '../store/db.js'
import { FeatureStore } from '../store/feature-store.js'
import { EventBus } from '../events/event-bus.js'
import { createHttpApp } from '../http/routes.js'

describe('Integration: HTTP API', () => {
  let db: Database.Database
  let store: FeatureStore
  let eventBus: EventBus
  let app: ReturnType<typeof createHttpApp>

  beforeEach(() => {
    db = createDb(':memory:')
    store = new FeatureStore(db)
    eventBus = new EventBus()
    app = createHttpApp(store, eventBus)
  })

  afterEach(() => {
    db.close()
  })

  it('creates and retrieves feature via API', async () => {
    // Create
    const createRes = await app.request('/api/features', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'test-api', title: 'API Test' }),
    })
    expect(createRes.status).toBe(201)

    // List
    const listRes = await app.request('/api/features')
    const features = await listRes.json()
    expect(features.length).toBe(1)
    expect(features[0].id).toBe('test-api')

    // Get single
    const getRes = await app.request('/api/features/test-api')
    const feature = await getRes.json()
    expect(feature.title).toBe('API Test')
  })

  it('updates feature status', async () => {
    store.create({ id: 'f1', title: 'Feature 1' })

    const res = await app.request('/api/features/f1/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    })

    expect(res.status).toBe(200)
    const updated = await res.json()
    expect(updated.status).toBe('active')
  })

  it('returns board aggregation', async () => {
    store.create({ id: 'f1', title: 'F1', status: 'planning' })
    store.create({ id: 'f2', title: 'F2', status: 'active' })

    const res = await app.request('/api/board')
    const board = await res.json()

    expect(board.featuresByStatus.planning.length).toBe(1)
    expect(board.featuresByStatus.active.length).toBe(1)
  })
})
```

**Step 2: 运行所有测试**

Run: `cd mcp-server && bun test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add mcp-server/src/__tests__/
git commit -m "test(mcp-server): add integration tests for HTTP API"
```

---

### Task 5.2: 更新 Makefile 和 README

**Files:**
- Modify: `Makefile` (if exists) or create
- Create: `mcp-server/README.md`

**Step 1: 创建 mcp-server/README.md**

```markdown
# SuperCrew MCP Server

Local MCP server for real-time feature management with Claude Code and Web UI.

## Quick Start

```bash
# Install dependencies
bun install

# Run in HTTP mode (for Web UI)
bun run src/index.ts

# Run in MCP mode (auto-detected when stdin is piped)
echo '{"method":"tools/list"}' | bun run src/index.ts
```

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `MCP_HTTP_PORT` | 3456 | HTTP API port |
| `MCP_WS_PORT` | 3457 | WebSocket port |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/features` | List all features |
| GET | `/api/features/:id` | Get feature by ID |
| POST | `/api/features` | Create feature |
| PATCH | `/api/features/:id/status` | Update status |
| DELETE | `/api/features/:id` | Delete feature |
| GET | `/api/board` | Get board aggregation |

## MCP Tools

| Tool | Description |
|------|-------------|
| `list_features` | List all features |
| `get_feature` | Get feature details |
| `create_feature` | Create new feature |
| `update_feature_status` | Update status |
| `log_progress` | Append log entry |

## WebSocket Events

Connect to `ws://localhost:3457` for real-time updates:

- `feature:created` - New feature added
- `feature:updated` - Feature modified
- `feature:deleted` - Feature removed
- `conflict:detected` - Sync conflict detected
```

**Step 2: Commit**

```bash
git add mcp-server/README.md
git commit -m "docs(mcp-server): add README with usage instructions"
```

---

### Task 5.3: 最终验证

**Step 1: 完整测试套件**

Run: `cd mcp-server && bun test`
Expected: All tests pass

**Step 2: TypeScript 检查**

Run: `cd mcp-server && bun run typecheck`
Expected: No errors

**Step 3: 手动测试 HTTP API**

```bash
cd mcp-server && bun run src/index.ts &
curl -X POST http://localhost:3456/api/features \
  -H "Content-Type: application/json" \
  -d '{"id":"test","title":"Test Feature"}'
curl http://localhost:3456/api/board
```

**Step 4: Final Commit**

```bash
git add .
git commit -m "feat(mcp-server): complete MCP Server implementation"
```

---

## Summary

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| Phase 1 | Project setup, SQLite, Event Bus, Branch Scanner | 1 week |
| Phase 2 | MCP Protocol integration | 0.5 week |
| Phase 3 | HTTP API + WebSocket | 1 week |
| Phase 4 | GitHub Sync Worker | 0.5 week |
| Phase 5 | Integration tests + docs | 0.5 week |

**Total: ~3.5 weeks**
