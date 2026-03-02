# GitHub API Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace local filesystem store with GitHub API reads/writes, and deploy the full stack on Vercel.

**Architecture:** Each authenticated request carries a JWT with `access_token` + `github_id`. The backend resolves the user's connected repo from a Vercel KV registry, then reads/writes `.team/` markdown files directly via GitHub API. SSE is removed; frontend polls instead. Hono serves as a single serverless function behind Vercel rewrites.

**Tech Stack:** Hono (existing), GitHub Contents API, `@vercel/kv` (Upstash Redis), `gray-matter` (existing), Vercel serverless Node.js runtime

---

## Context

### Key files
- `kanban/backend/src/store/index.ts` — file-based store (to be replaced)
- `kanban/backend/src/registry/file-registry.ts` — users.json registry (to be replaced)
- `kanban/backend/src/index.ts` — app entry (remove SSE/chokidar)
- `kanban/backend/src/routes/tasks.ts` — unauthenticated (to add auth)
- `kanban/backend/src/routes/sprints.ts` — unauthenticated (to add auth)
- `kanban/backend/src/routes/people.ts` — unauthenticated (to add auth)
- `kanban/backend/src/routes/knowledge.ts` — unauthenticated (to add auth)
- `kanban/backend/src/routes/decisions.ts` — unauthenticated (to add auth)

### JWT payload (already in place)
```ts
{ github_id: number, login: string, access_token: string, exp: number }
```

### GitHub Contents API patterns
```
GET  /repos/{owner}/{repo}/contents/{path}   → list dir or get file
PUT  /repos/{owner}/{repo}/contents/{path}   → create or update file (update needs sha)
DELETE /repos/{owner}/{repo}/contents/{path} → delete file (needs sha)
```
File content is base64-encoded. Every write/delete requires the current file SHA.

---

## Task 1: Create GitHub API store

**Files:**
- Create: `kanban/backend/src/store/github-store.ts`

### Step 1: Write the failing test

Create `kanban/backend/src/__tests__/github-store.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock global fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

import { listTasksGH, readTaskGH } from '../store/github-store.js'

const TOKEN = 'ghp_test'
const OWNER = 'testowner'
const REPO = 'testrepo'

describe('github-store', () => {
  beforeEach(() => { mockFetch.mockReset() })

  it('listTasksGH returns empty array when directory missing', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 } as any)
    const result = await listTasksGH(TOKEN, OWNER, REPO)
    expect(result).toEqual([])
  })

  it('listTasksGH skips template files', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { name: '_template.md', type: 'file' },
        { name: 'ENG-001.md', type: 'file' },
      ],
    } as any)
    // readTaskGH call for ENG-001
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: btoa('---\ntitle: Test Task\nstatus: backlog\npriority: P2\ncreated: 2026-01-01\nupdated: 2026-01-01\ntags: []\nblocks: []\nblocked_by: []\n---\nTask body'),
        sha: 'abc123',
      }),
    } as any)

    const result = await listTasksGH(TOKEN, OWNER, REPO)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('ENG-001')
    expect(result[0].title).toBe('Test Task')
  })

  it('readTaskGH returns null when file missing', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 } as any)
    const result = await readTaskGH(TOKEN, OWNER, REPO, 'ENG-999')
    expect(result).toBeNull()
  })
})
```

### Step 2: Run test to verify it fails

```bash
cd kanban && npx vitest run backend/src/__tests__/github-store.test.ts
```
Expected: FAIL — `listTasksGH` not found

### Step 3: Create `github-store.ts`

Create `kanban/backend/src/store/github-store.ts`:

```ts
import matter from 'gray-matter'
import type { Task, Sprint, Person, KnowledgeEntry, Decision, TaskStatus } from '../types/index.js'

const GH_API = 'https://api.github.com'
const UA = 'supercrew-app'

function ghHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'User-Agent': UA,
    'Content-Type': 'application/json',
  }
}

// ─── GitHub file helpers ───────────────────────────────────────────────────────

async function ghList(token: string, owner: string, repo: string, path: string) {
  const res = await fetch(`${GH_API}/repos/${owner}/${repo}/contents/${path}`, {
    headers: ghHeaders(token),
  })
  if (!res.ok) return null
  return res.json() as Promise<{ name: string; type: string; sha: string }[]>
}

async function ghGet(token: string, owner: string, repo: string, path: string) {
  const res = await fetch(`${GH_API}/repos/${owner}/${repo}/contents/${path}`, {
    headers: ghHeaders(token),
  })
  if (!res.ok) return null
  return res.json() as Promise<{ content: string; sha: string }>
}

async function ghPut(
  token: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  sha?: string,
) {
  const body: Record<string, string> = { message, content: btoa(content) }
  if (sha) body.sha = sha
  const res = await fetch(`${GH_API}/repos/${owner}/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: ghHeaders(token),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json() as any
    throw new Error(err.message ?? 'GitHub write failed')
  }
}

async function ghDelete(
  token: string,
  owner: string,
  repo: string,
  path: string,
  message: string,
) {
  const file = await ghGet(token, owner, repo, path)
  if (!file) return false
  const res = await fetch(`${GH_API}/repos/${owner}/${repo}/contents/${path}`, {
    method: 'DELETE',
    headers: ghHeaders(token),
    body: JSON.stringify({ message, sha: file.sha }),
  })
  return res.ok
}

function decodeContent(b64: string): string {
  // GitHub returns base64 with newlines
  return atob(b64.replace(/\n/g, ''))
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export async function listTasksGH(token: string, owner: string, repo: string): Promise<Task[]> {
  const files = await ghList(token, owner, repo, '.team/tasks')
  if (!files) return []
  const taskFiles = files.filter(f => f.name.endsWith('.md') && !f.name.startsWith('_'))
  const tasks = await Promise.all(
    taskFiles.map(f => readTaskGH(token, owner, repo, f.name.replace('.md', '')))
  )
  return tasks.filter(Boolean) as Task[]
}

export async function readTaskGH(token: string, owner: string, repo: string, id: string): Promise<Task | null> {
  const file = await ghGet(token, owner, repo, `.team/tasks/${id}.md`)
  if (!file) return null
  const { data, content } = matter(decodeContent(file.content))
  return {
    id,
    title: data.title ?? '',
    status: data.status ?? 'backlog',
    priority: data.priority ?? 'P2',
    assignee: data.assignee,
    team: data.team,
    sprint: data.sprint,
    created: data.created ?? new Date().toISOString().split('T')[0],
    updated: data.updated ?? new Date().toISOString().split('T')[0],
    tags: data.tags ?? [],
    blocks: data.blocks ?? [],
    blocked_by: data.blocked_by ?? [],
    plan_doc: data.plan_doc,
    pr_url: data.pr_url,
    body: content.trim(),
    _sha: file.sha,
  } as Task & { _sha: string }
}

export async function writeTaskGH(token: string, owner: string, repo: string, task: Task): Promise<void> {
  const { body, _sha, ...frontmatter } = task as any
  frontmatter.updated = new Date().toISOString().split('T')[0]
  const clean = Object.fromEntries(Object.entries(frontmatter).filter(([, v]) => v !== undefined))
  const content = matter.stringify(body ?? '', clean)

  // Get current SHA if file exists
  const existing = await ghGet(token, owner, repo, `.team/tasks/${task.id}.md`)
  await ghPut(
    token, owner, repo,
    `.team/tasks/${task.id}.md`,
    content,
    `chore: update task ${task.id}`,
    existing?.sha,
  )
}

export async function deleteTaskGH(token: string, owner: string, repo: string, id: string): Promise<boolean> {
  return ghDelete(token, owner, repo, `.team/tasks/${id}.md`, `chore: delete task ${id}`)
}

// ─── Sprints ──────────────────────────────────────────────────────────────────

export async function listSprintsGH(token: string, owner: string, repo: string): Promise<Sprint[]> {
  const files = await ghList(token, owner, repo, '.team/sprints')
  if (!files) return []
  const sprintFiles = files.filter(f => f.name.endsWith('.json'))
  const sprints = await Promise.all(
    sprintFiles.map(async f => {
      const file = await ghGet(token, owner, repo, `.team/sprints/${f.name}`)
      if (!file) return null
      return JSON.parse(decodeContent(file.content)) as Sprint
    })
  )
  return (sprints.filter(Boolean) as Sprint[]).sort((a, b) => b.id - a.id)
}

export async function writeSprintGH(token: string, owner: string, repo: string, sprint: Sprint): Promise<void> {
  const content = JSON.stringify(sprint, null, 2)
  const existing = await ghGet(token, owner, repo, `.team/sprints/sprint-${sprint.id}.json`)
  await ghPut(
    token, owner, repo,
    `.team/sprints/sprint-${sprint.id}.json`,
    content,
    `chore: update sprint ${sprint.id}`,
    existing?.sha,
  )
}

// ─── People ───────────────────────────────────────────────────────────────────

export async function listPeopleGH(token: string, owner: string, repo: string): Promise<Person[]> {
  const files = await ghList(token, owner, repo, '.team/people')
  if (!files) return []
  const personFiles = files.filter(f => f.name.endsWith('.md') && !f.name.startsWith('_'))
  const people = await Promise.all(
    personFiles.map(f => readPersonGH(token, owner, repo, f.name.replace('.md', '')))
  )
  return people.filter(Boolean) as Person[]
}

export async function readPersonGH(token: string, owner: string, repo: string, username: string): Promise<Person | null> {
  const file = await ghGet(token, owner, repo, `.team/people/${username}.md`)
  if (!file) return null
  const { data, content } = matter(decodeContent(file.content))
  return {
    username,
    name: data.name ?? username,
    team: data.team ?? '',
    updated: data.updated ?? '',
    current_task: data.current_task,
    blocked_by: data.blocked_by,
    completed_today: data.completed_today ?? [],
    body: content.trim(),
  }
}

export async function writePersonGH(token: string, owner: string, repo: string, person: Person): Promise<void> {
  const { body, ...frontmatter } = person
  frontmatter.updated = new Date().toISOString().split('T')[0]
  const content = matter.stringify(body ?? '', frontmatter)
  const existing = await ghGet(token, owner, repo, `.team/people/${person.username}.md`)
  await ghPut(
    token, owner, repo,
    `.team/people/${person.username}.md`,
    content,
    `chore: update person ${person.username}`,
    existing?.sha,
  )
}

// ─── Knowledge ────────────────────────────────────────────────────────────────

export async function listKnowledgeGH(token: string, owner: string, repo: string): Promise<KnowledgeEntry[]> {
  const files = await ghList(token, owner, repo, '.team/knowledge')
  if (!files) return []
  const knowledgeFiles = files.filter(f => f.name.endsWith('.md') && !f.name.startsWith('_'))
  const entries = await Promise.all(
    knowledgeFiles.map(async f => {
      const file = await ghGet(token, owner, repo, `.team/knowledge/${f.name}`)
      if (!file) return null
      const slug = f.name.replace('.md', '')
      const { data, content } = matter(decodeContent(file.content))
      return {
        slug,
        title: data.title ?? slug,
        tags: data.tags ?? [],
        author: data.author ?? '',
        date: data.date ?? '',
        body: content.trim(),
      } as KnowledgeEntry
    })
  )
  return entries.filter(Boolean) as KnowledgeEntry[]
}

// ─── Decisions ────────────────────────────────────────────────────────────────

export async function listDecisionsGH(token: string, owner: string, repo: string): Promise<Decision[]> {
  const files = await ghList(token, owner, repo, '.team/decisions')
  if (!files) return []
  const decisionFiles = files.filter(f => f.name.endsWith('.md') && !f.name.startsWith('_'))
  const decisions = await Promise.all(
    decisionFiles.map(async f => {
      const file = await ghGet(token, owner, repo, `.team/decisions/${f.name}`)
      if (!file) return null
      const id = f.name.replace('.md', '')
      const { data, content } = matter(decodeContent(file.content))
      return {
        id,
        title: data.title ?? '',
        date: data.date ?? '',
        author: data.author ?? '',
        status: data.status ?? 'proposed',
        body: content.trim(),
      } as Decision
    })
  )
  return (decisions.filter(Boolean) as Decision[]).sort((a, b) => a.id.localeCompare(b.id))
}
```

### Step 4: Run tests

```bash
cd kanban && npx vitest run backend/src/__tests__/github-store.test.ts
```
Expected: PASS (3 tests)

### Step 5: Commit

```bash
cd kanban && git add backend/src/store/github-store.ts backend/src/__tests__/github-store.test.ts
git commit -m "feat: add GitHub API store to replace local filesystem reads"
```

---

## Task 2: Add auth context helper

Every data route needs to know the access_token and repo_full_name for the requesting user.

**Files:**
- Create: `kanban/backend/src/lib/get-github-context.ts`

### Step 1: Write failing test

Create `kanban/backend/src/__tests__/get-github-context.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { sign } from 'hono/jwt'

const JWT_SECRET = 'test-secret'
process.env.JWT_SECRET = JWT_SECRET

const mockRegistry = {
  listProjects: vi.fn(),
}

vi.mock('../registry/file-registry.js', () => ({ FileRegistry: vi.fn(() => mockRegistry) }))

import { getGitHubContext } from '../lib/get-github-context.js'

describe('getGitHubContext', () => {
  it('throws Unauthorized when no Bearer token', async () => {
    await expect(getGitHubContext(undefined, mockRegistry as any)).rejects.toThrow('Unauthorized')
  })

  it('throws NoProject when user has no projects', async () => {
    const token = await sign({ github_id: 1, login: 'test', access_token: 'ghp_x', exp: 9999999999 }, JWT_SECRET, 'HS256')
    mockRegistry.listProjects.mockResolvedValueOnce([])
    await expect(getGitHubContext(`Bearer ${token}`, mockRegistry as any)).rejects.toThrow('NoProject')
  })

  it('returns context when user has a project', async () => {
    const token = await sign({ github_id: 1, login: 'test', access_token: 'ghp_x', exp: 9999999999 }, JWT_SECRET, 'HS256')
    mockRegistry.listProjects.mockResolvedValueOnce([{ repo_full_name: 'owner/repo', id: 'proj_1', added_at: '', last_visited: '', repo_url: '' }])
    const ctx = await getGitHubContext(`Bearer ${token}`, mockRegistry as any)
    expect(ctx.accessToken).toBe('ghp_x')
    expect(ctx.owner).toBe('owner')
    expect(ctx.repo).toBe('repo')
  })
})
```

### Step 2: Run to verify fail

```bash
cd kanban && npx vitest run backend/src/__tests__/get-github-context.test.ts
```
Expected: FAIL

### Step 3: Create the helper

Create `kanban/backend/src/lib/get-github-context.ts`:

```ts
import { verify } from 'hono/jwt'
import type { UserRegistry } from '../registry/types.js'

const JWT_SECRET = process.env.JWT_SECRET!

export interface GitHubContext {
  accessToken: string
  githubId: number
  owner: string
  repo: string
  repoFullName: string
}

export async function getGitHubContext(
  authHeader: string | undefined,
  registry: UserRegistry,
): Promise<GitHubContext> {
  if (!authHeader?.startsWith('Bearer ')) throw new Error('Unauthorized')

  const payload = await verify(authHeader.slice(7), JWT_SECRET, 'HS256').catch(() => {
    throw new Error('Unauthorized')
  }) as any

  const projects = await registry.listProjects(payload.github_id)
  if (!projects.length) throw new Error('NoProject')

  const [owner, repo] = projects[0].repo_full_name.split('/')
  return {
    accessToken: payload.access_token,
    githubId: payload.github_id,
    owner,
    repo,
    repoFullName: projects[0].repo_full_name,
  }
}
```

### Step 4: Run tests

```bash
cd kanban && npx vitest run backend/src/__tests__/get-github-context.test.ts
```
Expected: PASS (3 tests)

### Step 5: Commit

```bash
git add backend/src/lib/get-github-context.ts backend/src/__tests__/get-github-context.test.ts
git commit -m "feat: add getGitHubContext helper for auth + repo resolution"
```

---

## Task 3: Refactor data routes to use GitHub store

Convert tasks, sprints, people, knowledge, decisions routes from file-based to GitHub API. All 5 routes follow the same pattern: become factory functions that receive `registry`.

**Files:**
- Modify: `kanban/backend/src/routes/tasks.ts`
- Modify: `kanban/backend/src/routes/sprints.ts`
- Modify: `kanban/backend/src/routes/people.ts`
- Modify: `kanban/backend/src/routes/knowledge.ts`
- Modify: `kanban/backend/src/routes/decisions.ts`

### Step 1: No test to write (routes tested via integration; unit tests already cover store)

### Step 2: Replace `tasks.ts`

Replace entire `kanban/backend/src/routes/tasks.ts`:

```ts
import { Hono } from 'hono'
import { listTasksGH, readTaskGH, writeTaskGH, deleteTaskGH } from '../store/github-store.js'
import { getGitHubContext } from '../lib/get-github-context.js'
import type { UserRegistry } from '../registry/types.js'
import type { Task, TaskStatus } from '../types/index.js'

export function createTasksRouter(registry: UserRegistry) {
  const app = new Hono()

  app.get('/', async (c) => {
    try {
      const ctx = await getGitHubContext(c.req.header('Authorization'), registry)
      const tasks = await listTasksGH(ctx.accessToken, ctx.owner, ctx.repo)
      return c.json(tasks)
    } catch (e: any) {
      return c.json({ error: e.message }, e.message === 'Unauthorized' ? 401 : 400)
    }
  })

  app.get('/:id', async (c) => {
    try {
      const ctx = await getGitHubContext(c.req.header('Authorization'), registry)
      const task = await readTaskGH(ctx.accessToken, ctx.owner, ctx.repo, c.req.param('id'))
      if (!task) return c.json({ error: 'Not found' }, 404)
      return c.json(task)
    } catch (e: any) {
      return c.json({ error: e.message }, e.message === 'Unauthorized' ? 401 : 400)
    }
  })

  app.post('/', async (c) => {
    try {
      const ctx = await getGitHubContext(c.req.header('Authorization'), registry)
      const body = await c.req.json<Partial<Task>>()
      if (!body.id || !body.title) return c.json({ error: 'id and title are required' }, 400)
      const existing = await readTaskGH(ctx.accessToken, ctx.owner, ctx.repo, body.id)
      if (existing) return c.json({ error: `Task ${body.id} already exists` }, 409)
      const task: Task = {
        id: body.id,
        title: body.title,
        status: body.status ?? 'backlog',
        priority: body.priority ?? 'P2',
        assignee: body.assignee,
        team: body.team,
        sprint: body.sprint,
        created: new Date().toISOString().split('T')[0],
        updated: new Date().toISOString().split('T')[0],
        tags: body.tags ?? [],
        blocks: body.blocks ?? [],
        blocked_by: body.blocked_by ?? [],
        plan_doc: body.plan_doc,
        pr_url: body.pr_url,
        body: body.body ?? '',
      }
      await writeTaskGH(ctx.accessToken, ctx.owner, ctx.repo, task)
      return c.json(task, 201)
    } catch (e: any) {
      return c.json({ error: e.message }, e.message === 'Unauthorized' ? 401 : 400)
    }
  })

  app.patch('/:id', async (c) => {
    try {
      const ctx = await getGitHubContext(c.req.header('Authorization'), registry)
      const id = c.req.param('id')
      const existing = await readTaskGH(ctx.accessToken, ctx.owner, ctx.repo, id)
      if (!existing) return c.json({ error: 'Not found' }, 404)
      const body = await c.req.json<Partial<Task>>()
      const updated: Task = { ...existing, ...body, id }
      await writeTaskGH(ctx.accessToken, ctx.owner, ctx.repo, updated)
      return c.json(updated)
    } catch (e: any) {
      return c.json({ error: e.message }, e.message === 'Unauthorized' ? 401 : 400)
    }
  })

  app.put('/:id/status', async (c) => {
    try {
      const ctx = await getGitHubContext(c.req.header('Authorization'), registry)
      const id = c.req.param('id')
      const { status } = await c.req.json<{ status: TaskStatus }>()
      const existing = await readTaskGH(ctx.accessToken, ctx.owner, ctx.repo, id)
      if (!existing) return c.json({ error: 'Not found' }, 404)
      const updated = { ...existing, status }
      await writeTaskGH(ctx.accessToken, ctx.owner, ctx.repo, updated)
      return c.json(updated)
    } catch (e: any) {
      return c.json({ error: e.message }, e.message === 'Unauthorized' ? 401 : 400)
    }
  })

  app.delete('/:id', async (c) => {
    try {
      const ctx = await getGitHubContext(c.req.header('Authorization'), registry)
      const deleted = await deleteTaskGH(ctx.accessToken, ctx.owner, ctx.repo, c.req.param('id'))
      if (!deleted) return c.json({ error: 'Not found' }, 404)
      return c.json({ ok: true })
    } catch (e: any) {
      return c.json({ error: e.message }, e.message === 'Unauthorized' ? 401 : 400)
    }
  })

  return app
}
```

### Step 3: Replace `sprints.ts`

Replace entire `kanban/backend/src/routes/sprints.ts`:

```ts
import { Hono } from 'hono'
import { listSprintsGH, writeSprintGH } from '../store/github-store.js'
import { getGitHubContext } from '../lib/get-github-context.js'
import type { UserRegistry } from '../registry/types.js'
import type { Sprint } from '../types/index.js'

export function createSprintsRouter(registry: UserRegistry) {
  const app = new Hono()

  app.get('/', async (c) => {
    try {
      const ctx = await getGitHubContext(c.req.header('Authorization'), registry)
      return c.json(await listSprintsGH(ctx.accessToken, ctx.owner, ctx.repo))
    } catch (e: any) {
      return c.json({ error: e.message }, e.message === 'Unauthorized' ? 401 : 400)
    }
  })

  app.post('/', async (c) => {
    try {
      const ctx = await getGitHubContext(c.req.header('Authorization'), registry)
      const body = await c.req.json<Sprint>()
      await writeSprintGH(ctx.accessToken, ctx.owner, ctx.repo, body)
      return c.json(body, 201)
    } catch (e: any) {
      return c.json({ error: e.message }, e.message === 'Unauthorized' ? 401 : 400)
    }
  })

  app.patch('/:id', async (c) => {
    try {
      const ctx = await getGitHubContext(c.req.header('Authorization'), registry)
      const body = await c.req.json<Partial<Sprint>>()
      const sprints = await listSprintsGH(ctx.accessToken, ctx.owner, ctx.repo)
      const sprint = sprints.find(s => s.id === parseInt(c.req.param('id')))
      if (!sprint) return c.json({ error: 'Not found' }, 404)
      const updated = { ...sprint, ...body }
      await writeSprintGH(ctx.accessToken, ctx.owner, ctx.repo, updated)
      return c.json(updated)
    } catch (e: any) {
      return c.json({ error: e.message }, e.message === 'Unauthorized' ? 401 : 400)
    }
  })

  return app
}
```

### Step 4: Replace `people.ts`

Replace entire `kanban/backend/src/routes/people.ts`:

```ts
import { Hono } from 'hono'
import { listPeopleGH, readPersonGH, writePersonGH } from '../store/github-store.js'
import { getGitHubContext } from '../lib/get-github-context.js'
import type { UserRegistry } from '../registry/types.js'
import type { Person } from '../types/index.js'

export function createPeopleRouter(registry: UserRegistry) {
  const app = new Hono()

  app.get('/', async (c) => {
    try {
      const ctx = await getGitHubContext(c.req.header('Authorization'), registry)
      return c.json(await listPeopleGH(ctx.accessToken, ctx.owner, ctx.repo))
    } catch (e: any) {
      return c.json({ error: e.message }, e.message === 'Unauthorized' ? 401 : 400)
    }
  })

  app.get('/:username', async (c) => {
    try {
      const ctx = await getGitHubContext(c.req.header('Authorization'), registry)
      const person = await readPersonGH(ctx.accessToken, ctx.owner, ctx.repo, c.req.param('username'))
      if (!person) return c.json({ error: 'Not found' }, 404)
      return c.json(person)
    } catch (e: any) {
      return c.json({ error: e.message }, e.message === 'Unauthorized' ? 401 : 400)
    }
  })

  app.post('/', async (c) => {
    try {
      const ctx = await getGitHubContext(c.req.header('Authorization'), registry)
      const body = await c.req.json<Partial<Person>>()
      if (!body.username) return c.json({ error: 'username is required' }, 400)
      const existing = await readPersonGH(ctx.accessToken, ctx.owner, ctx.repo, body.username)
      if (existing) return c.json({ error: `Person ${body.username} already exists` }, 409)
      const person: Person = {
        username: body.username,
        name: body.name ?? body.username,
        team: body.team ?? '',
        updated: new Date().toISOString().split('T')[0],
        current_task: body.current_task,
        blocked_by: body.blocked_by,
        completed_today: body.completed_today ?? [],
        body: body.body ?? '',
      }
      await writePersonGH(ctx.accessToken, ctx.owner, ctx.repo, person)
      return c.json(person, 201)
    } catch (e: any) {
      return c.json({ error: e.message }, e.message === 'Unauthorized' ? 401 : 400)
    }
  })

  app.patch('/:username', async (c) => {
    try {
      const ctx = await getGitHubContext(c.req.header('Authorization'), registry)
      const username = c.req.param('username')
      const existing = await readPersonGH(ctx.accessToken, ctx.owner, ctx.repo, username)
      if (!existing) return c.json({ error: 'Not found' }, 404)
      const body = await c.req.json<Partial<Person>>()
      const updated = { ...existing, ...body, username }
      await writePersonGH(ctx.accessToken, ctx.owner, ctx.repo, updated)
      return c.json(updated)
    } catch (e: any) {
      return c.json({ error: e.message }, e.message === 'Unauthorized' ? 401 : 400)
    }
  })

  return app
}
```

### Step 5: Replace `knowledge.ts`

Replace entire `kanban/backend/src/routes/knowledge.ts`:

```ts
import { Hono } from 'hono'
import { listKnowledgeGH } from '../store/github-store.js'
import { getGitHubContext } from '../lib/get-github-context.js'
import type { UserRegistry } from '../registry/types.js'

export function createKnowledgeRouter(registry: UserRegistry) {
  const app = new Hono()

  app.get('/', async (c) => {
    try {
      const ctx = await getGitHubContext(c.req.header('Authorization'), registry)
      return c.json(await listKnowledgeGH(ctx.accessToken, ctx.owner, ctx.repo))
    } catch (e: any) {
      return c.json({ error: e.message }, e.message === 'Unauthorized' ? 401 : 400)
    }
  })

  return app
}
```

### Step 6: Replace `decisions.ts`

Replace entire `kanban/backend/src/routes/decisions.ts`:

```ts
import { Hono } from 'hono'
import { listDecisionsGH } from '../store/github-store.js'
import { getGitHubContext } from '../lib/get-github-context.js'
import type { UserRegistry } from '../registry/types.js'

export function createDecisionsRouter(registry: UserRegistry) {
  const app = new Hono()

  app.get('/', async (c) => {
    try {
      const ctx = await getGitHubContext(c.req.header('Authorization'), registry)
      return c.json(await listDecisionsGH(ctx.accessToken, ctx.owner, ctx.repo))
    } catch (e: any) {
      return c.json({ error: e.message }, e.message === 'Unauthorized' ? 401 : 400)
    }
  })

  return app
}
```

### Step 7: Commit

```bash
git add backend/src/routes/
git commit -m "feat: migrate data routes to GitHub API store"
```

---

## Task 4: Create Vercel KV registry + update index.ts

**Files:**
- Create: `kanban/backend/src/registry/kv-registry.ts`
- Modify: `kanban/backend/src/index.ts`
- Modify: `kanban/backend/package.json`

### Step 1: Install Vercel KV

```bash
cd kanban/backend && npm install @vercel/kv
```

### Step 2: Create KV registry

Create `kanban/backend/src/registry/kv-registry.ts`:

```ts
import { kv } from '@vercel/kv'
import type { User, Project, UserRegistry } from './types.js'

export class KVRegistry implements UserRegistry {
  async findUser(githubId: number): Promise<User | null> {
    return kv.get<User>(`user:${githubId}`)
  }

  async saveUser(user: User): Promise<void> {
    await kv.set(`user:${user.github_id}`, user)
  }

  async addProject(githubId: number, info: Omit<Project, 'id' | 'added_at' | 'last_visited'>): Promise<Project> {
    const user = await this.findUser(githubId)
    if (!user) throw new Error('User not found')
    const project: Project = {
      ...info,
      id: `proj_${Date.now()}`,
      added_at: new Date().toISOString(),
      last_visited: new Date().toISOString(),
    }
    user.projects.push(project)
    await this.saveUser(user)
    return project
  }

  async removeProject(githubId: number, projectId: string): Promise<void> {
    const user = await this.findUser(githubId)
    if (!user) throw new Error('User not found')
    user.projects = user.projects.filter(p => p.id !== projectId)
    await this.saveUser(user)
  }

  async listProjects(githubId: number): Promise<Project[]> {
    const user = await this.findUser(githubId)
    return user?.projects ?? []
  }

  async touchProject(githubId: number, projectId: string): Promise<void> {
    const user = await this.findUser(githubId)
    if (!user) return
    const proj = user.projects.find(p => p.id === projectId)
    if (proj) {
      proj.last_visited = new Date().toISOString()
      await this.saveUser(user)
    }
  }
}
```

### Step 3: Update `index.ts`

Replace entire `kanban/backend/src/index.ts`:

```ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { KVRegistry } from './registry/kv-registry.js'
import { FileRegistry } from './registry/file-registry.js'
import { createAuthRouter } from './routes/auth.js'
import { createProjectsRouter } from './routes/projects.js'
import { createTasksRouter } from './routes/tasks.js'
import { createSprintsRouter } from './routes/sprints.js'
import { createPeopleRouter } from './routes/people.js'
import { createKnowledgeRouter } from './routes/knowledge.js'
import { createDecisionsRouter } from './routes/decisions.js'
import { getGitHubContext } from './lib/get-github-context.js'
import { listTasksGH, listSprintsGH, listPeopleGH } from './store/github-store.js'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Use KV registry in production (Vercel), file registry locally
const registry = process.env.KV_REST_API_URL
  ? new KVRegistry()
  : new FileRegistry(join(__dirname, '../../data/users.json'))

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173'
const PORT = parseInt(process.env.PORT ?? '3001', 10)

export const app = new Hono()

app.use('*', cors({
  origin: [FRONTEND_URL, 'http://localhost:5173', 'http://localhost:5174'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

app.route('/auth', createAuthRouter(registry))
app.route('/api/projects', createProjectsRouter(registry))
app.route('/api/tasks', createTasksRouter(registry))
app.route('/api/sprints', createSprintsRouter(registry))
app.route('/api/people', createPeopleRouter(registry))
app.route('/api/knowledge', createKnowledgeRouter(registry))
app.route('/api/decisions', createDecisionsRouter(registry))

// Board: aggregate endpoint
app.get('/api/board', async (c) => {
  try {
    const ctx = await getGitHubContext(c.req.header('Authorization'), registry)
    const [tasks, sprints, people] = await Promise.all([
      listTasksGH(ctx.accessToken, ctx.owner, ctx.repo),
      listSprintsGH(ctx.accessToken, ctx.owner, ctx.repo),
      listPeopleGH(ctx.accessToken, ctx.owner, ctx.repo),
    ])
    return c.json({ tasks, sprints, people })
  } catch (e: any) {
    return c.json({ error: e.message }, e.message === 'Unauthorized' ? 401 : 400)
  }
})

app.get('/health', (c) => c.json({ ok: true }))

// Local dev entry point (Bun)
if (typeof Bun !== 'undefined') {
  console.log(`Backend running on http://localhost:${PORT}`)
  // @ts-ignore
  Bun.serve({ port: PORT, fetch: app.fetch })
}

export default app
```

### Step 4: Commit

```bash
cd kanban && git add backend/src/registry/kv-registry.ts backend/src/index.ts backend/backend/package.json
git commit -m "feat: add Vercel KV registry, clean up index.ts (remove SSE/chokidar)"
```

---

## Task 5: Add Vercel entry point and config

**Files:**
- Create: `kanban/backend/api/index.ts`
- Create: `kanban/vercel.json`

### Step 1: Create Vercel handler

Create `kanban/backend/api/index.ts`:

```ts
import { handle } from 'hono/vercel'
import app from '../src/index.js'

export const config = { runtime: 'nodejs20.x' }

export default handle(app)
```

### Step 2: Create `vercel.json`

Create `kanban/vercel.json`:

```json
{
  "buildCommand": "cd frontend && pnpm install && pnpm build",
  "outputDirectory": "frontend/packages/local-web/dist",
  "installCommand": "cd backend && npm install",
  "rewrites": [
    { "source": "/api/:path*", "destination": "/backend/api/index" },
    { "source": "/auth/:path*", "destination": "/backend/api/index" },
    { "source": "/health", "destination": "/backend/api/index" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### Step 3: Add `hono/vercel` dependency

```bash
cd kanban/backend && npm install hono
```
(already installed — just verify `hono` >=  4.0 which includes vercel adapter)

### Step 4: Commit

```bash
cd kanban && git add backend/api/index.ts vercel.json
git commit -m "feat: add Vercel entry point and vercel.json config"
```

---

## Task 6: Remove SSE from frontend, add polling

Check if frontend uses EventSource and replace with polling.

**Files:**
- Search: any `EventSource` usage in `kanban/frontend/`
- If found: replace with `setInterval` + `queryClient.invalidateQueries`

### Step 1: Search for EventSource usage

```bash
grep -r "EventSource\|/api/events" kanban/frontend/src --include="*.ts" --include="*.tsx"
```

### Step 2: If found, replace with polling

In whichever file uses EventSource, replace the pattern:

```ts
// REMOVE this:
const es = new EventSource('/api/events')
es.addEventListener('change', () => queryClient.invalidateQueries())

// ADD this instead (30s polling):
useEffect(() => {
  const interval = setInterval(() => {
    queryClient.invalidateQueries()
  }, 30_000)
  return () => clearInterval(interval)
}, [queryClient])
```

### Step 3: Commit if changed

```bash
git add kanban/frontend/
git commit -m "feat: replace SSE with 30s polling for data refresh"
```

---

## Task 7: Set environment variables and deploy

### Step 1: Set up Vercel KV

1. Go to vercel.com → your project → Storage tab → Create KV Store
2. Link to project → Vercel auto-adds `KV_REST_API_URL`, `KV_REST_API_TOKEN` env vars

### Step 2: Set remaining env vars in Vercel dashboard

```
GITHUB_CLIENT_ID=<your GitHub OAuth App client id>
GITHUB_CLIENT_SECRET=<your GitHub OAuth App client secret>
JWT_SECRET=<random 32-char string>
FRONTEND_URL=https://<your-vercel-app>.vercel.app
BACKEND_URL=https://<your-vercel-app>.vercel.app
```

**Important:** Update GitHub OAuth App's callback URL to:
`https://<your-vercel-app>.vercel.app/auth/callback`

### Step 3: Push and deploy

```bash
cd kanban && git add . && git commit -m "chore: ready for Vercel deployment"
git push
```

Vercel auto-deploys on push to main.

### Step 4: Verify

Open `https://<your-vercel-app>.vercel.app` → should load login page.
Complete GitHub OAuth → should redirect to welcome page → connect a repo → board should load.
