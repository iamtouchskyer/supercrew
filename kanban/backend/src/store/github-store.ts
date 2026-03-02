import matter from 'gray-matter'
import type { Task, Sprint, Person, KnowledgeEntry, Decision } from '../types/index.js'

const GH_API = 'https://api.github.com'
const UA = 'supercrew-app'

function ghHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'User-Agent': UA,
    'Content-Type': 'application/json',
  }
}

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
  const body: Record<string, string> = { message, content: btoa(unescape(encodeURIComponent(content))) }
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
  return decodeURIComponent(escape(atob(b64.replace(/\n/g, ''))))
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
  } as Task
}

export async function writeTaskGH(token: string, owner: string, repo: string, task: Task): Promise<void> {
  const { body, ...frontmatter } = task as any
  frontmatter.updated = new Date().toISOString().split('T')[0]
  const clean = Object.fromEntries(Object.entries(frontmatter).filter(([, v]) => v !== undefined))
  const content = matter.stringify(body ?? '', clean)
  const existing = await ghGet(token, owner, repo, `.team/tasks/${task.id}.md`)
  await ghPut(token, owner, repo, `.team/tasks/${task.id}.md`, content, `chore: update task ${task.id}`, existing?.sha)
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
  await ghPut(token, owner, repo, `.team/sprints/sprint-${sprint.id}.json`, content, `chore: update sprint ${sprint.id}`, existing?.sha)
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
  await ghPut(token, owner, repo, `.team/people/${person.username}.md`, content, `chore: update person ${person.username}`, existing?.sha)
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
      return { slug, title: data.title ?? slug, tags: data.tags ?? [], author: data.author ?? '', date: data.date ?? '', body: content.trim() } as KnowledgeEntry
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
      return { id, title: data.title ?? '', date: data.date ?? '', author: data.author ?? '', status: data.status ?? 'proposed', body: content.trim() } as Decision
    })
  )
  return (decisions.filter(Boolean) as Decision[]).sort((a, b) => a.id.localeCompare(b.id))
}
