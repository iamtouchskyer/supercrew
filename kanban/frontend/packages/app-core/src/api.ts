import type { Task, Sprint, Person, Board, TaskStatus } from './types.js'
import { authHeaders, clearToken } from './auth.js'

const BASE = '/api'

let redirecting = false

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    if (res.status === 401 && !redirecting) {
      redirecting = true
      clearToken()
      window.location.href = '/login'
    }
    throw new Error(`${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

/** Merge auth + extra headers */
function headers(extra?: Record<string, string>): Record<string, string> {
  return { ...authHeaders(), ...extra }
}

// ─── Board ────────────────────────────────────────────────────────────────────

export const fetchBoard = (): Promise<Board> =>
  fetch(`${BASE}/board`, { headers: headers() }).then(json<Board>)

// ─── Tasks ────────────────────────────────────────────────────────────────────

export const fetchTasks = (): Promise<Task[]> =>
  fetch(`${BASE}/tasks`, { headers: headers() }).then(json<Task[]>)

export const fetchTask = (id: string): Promise<Task> =>
  fetch(`${BASE}/tasks/${id}`, { headers: headers() }).then(json<Task>)

export const createTask = (task: Omit<Task, 'created' | 'updated'>): Promise<Task> =>
  fetch(`${BASE}/tasks`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(task),
  }).then(json<Task>)

export const updateTask = (id: string, patch: Partial<Task>): Promise<Task> =>
  fetch(`${BASE}/tasks/${id}`, {
    method: 'PATCH',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(patch),
  }).then(json<Task>)

export const updateTaskStatus = (id: string, status: TaskStatus): Promise<Task> =>
  fetch(`${BASE}/tasks/${id}/status`, {
    method: 'PUT',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ status }),
  }).then(json<Task>)

export const deleteTask = (id: string): Promise<{ ok: boolean }> =>
  fetch(`${BASE}/tasks/${id}`, { method: 'DELETE', headers: headers() }).then(json<{ ok: boolean }>)

// ─── Sprints ──────────────────────────────────────────────────────────────────

export const fetchSprints = (): Promise<Sprint[]> =>
  fetch(`${BASE}/sprints`, { headers: headers() }).then(json<Sprint[]>)

export const updateSprint = (id: number, patch: Partial<Sprint>): Promise<Sprint> =>
  fetch(`${BASE}/sprints/${id}`, {
    method: 'PATCH',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(patch),
  }).then(json<Sprint>)

// ─── People ───────────────────────────────────────────────────────────────────

export const fetchPeople = (): Promise<Person[]> =>
  fetch(`${BASE}/people`, { headers: headers() }).then(json<Person[]>)

export const updatePerson = (username: string, patch: Partial<Person>): Promise<Person> =>
  fetch(`${BASE}/people/${username}`, {
    method: 'PATCH',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(patch),
  }).then(json<Person>)

// ─── Knowledge & Decisions ────────────────────────────────────────────────────

export const fetchKnowledge = (): Promise<import('./types.js').KnowledgeEntry[]> =>
  fetch(`${BASE}/knowledge`, { headers: headers() }).then(json<import('./types.js').KnowledgeEntry[]>)

export const fetchDecisions = (): Promise<import('./types.js').Decision[]> =>
  fetch(`${BASE}/decisions`, { headers: headers() }).then(json<import('./types.js').Decision[]>)
