// Supercrew feature store — reads .supercrew/features/ directory
// Converts meta.yaml + plan.md into Task-compatible objects for Kanban display
// Enabled via SUPERCREW_DEMO=true environment variable

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'fs'
import { join } from 'path'
import matter from 'gray-matter'
import type { Task, TaskStatus, TaskPriority } from '../types/index.js'

// ─── Types ────────────────────────────────────────────────────────────────────

type SupercrewStatus = 'planning' | 'designing' | 'ready' | 'active' | 'blocked' | 'done'

interface FeatureMeta {
  id: string
  title: string
  status: SupercrewStatus
  owner: string
  priority: TaskPriority
  teams: string[]
  target_release: string
  created: string
  updated: string
  tags: string[]
  blocked_by: string
}

interface PlanFrontmatter {
  total_tasks: number
  completed_tasks: number
  progress: number
}

// ─── Status mapping ───────────────────────────────────────────────────────────
// Maps .supercrew status flow to Kanban column status

const STATUS_MAP: Record<SupercrewStatus, TaskStatus> = {
  planning:  'backlog',
  designing: 'todo',
  ready:     'todo',
  active:    'in-progress',
  blocked:   'in-review',    // Use in-review column to highlight blocked items
  done:      'done',
}

// Reverse map: Kanban column status → .supercrew status
const REVERSE_STATUS_MAP: Record<TaskStatus, SupercrewStatus> = {
  'backlog':     'planning',
  'todo':        'ready',
  'in-progress': 'active',
  'in-review':   'blocked',
  'done':        'done',
}

// ─── Directory resolution ─────────────────────────────────────────────────────

function getSupercrewDir(): string {
  return process.env.SUPERCREW_DIR ?? join(process.cwd(), '../..', '.supercrew/features')
}

// ─── Feature reading ──────────────────────────────────────────────────────────

function readFeatureMeta(featureDir: string): FeatureMeta | null {
  const metaPath = join(featureDir, 'meta.yaml')
  if (!existsSync(metaPath)) return null

  try {
    const raw = readFileSync(metaPath, 'utf8')
    // Wrap raw YAML in frontmatter delimiters so gray-matter can parse it
    const { data } = matter(`---\n${raw}\n---\n`)
    return {
      id: data.id ?? '',
      title: data.title ?? '',
      status: data.status ?? 'planning',
      owner: data.owner ?? '',
      priority: data.priority ?? 'P2',
      teams: data.teams ?? [],
      target_release: data.target_release ?? '',
      created: data.created ?? '',
      updated: data.updated ?? '',
      tags: data.tags ?? [],
      blocked_by: data.blocked_by ?? '',
    }
  } catch {
    return null
  }
}

function readFeaturePlan(featureDir: string): { frontmatter: PlanFrontmatter; body: string } | null {
  const planPath = join(featureDir, 'plan.md')
  if (!existsSync(planPath)) return null

  try {
    const raw = readFileSync(planPath, 'utf8')
    const { data, content } = matter(raw)
    return {
      frontmatter: {
        total_tasks: data.total_tasks ?? 0,
        completed_tasks: data.completed_tasks ?? 0,
        progress: data.progress ?? 0,
      },
      body: content.trim(),
    }
  } catch {
    return null
  }
}

function readFeatureDesign(featureDir: string): string {
  const designPath = join(featureDir, 'design.md')
  if (!existsSync(designPath)) return ''

  try {
    const raw = readFileSync(designPath, 'utf8')
    const { content } = matter(raw)
    return content.trim()
  } catch {
    return ''
  }
}

// ─── Convert feature to Task ──────────────────────────────────────────────────

function featureToTask(featureDir: string): Task | null {
  const meta = readFeatureMeta(featureDir)
  if (!meta) return null

  const plan = readFeaturePlan(featureDir)
  const designSummary = readFeatureDesign(featureDir)

  // Build body from plan + design info
  const bodyParts: string[] = []

  if (meta.target_release) {
    bodyParts.push(`**Target Release**: ${meta.target_release}`)
  }

  if (plan) {
    bodyParts.push(`**Progress**: ${plan.frontmatter.completed_tasks}/${plan.frontmatter.total_tasks} tasks (${plan.frontmatter.progress}%)`)
    bodyParts.push('')
    bodyParts.push(plan.body)
  }

  if (meta.teams.length > 0) {
    bodyParts.push('')
    bodyParts.push(`**Teams**: ${meta.teams.join(', ')}`)
  }

  return {
    id: `SC-${meta.id}`,
    title: `${meta.title}`,
    status: STATUS_MAP[meta.status] ?? 'backlog',
    priority: meta.priority,
    assignee: meta.owner,
    team: meta.teams[0],
    sprint: undefined,
    created: meta.created,
    updated: meta.updated,
    tags: [...meta.tags, 'supercrew', meta.status],
    blocks: [],
    blocked_by: meta.blocked_by ? [`SC-${meta.blocked_by}`] : [],
    plan_doc: `.supercrew/features/${meta.id}/plan.md`,
    pr_url: undefined,
    body: bodyParts.join('\n'),
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function isSupcrewDemoEnabled(): boolean {
  return process.env.SUPERCREW_DEMO === 'true'
}

export function listSupercrewFeatures(): Task[] {
  const dir = getSupercrewDir()
  if (!existsSync(dir)) return []

  return readdirSync(dir)
    .filter(f => {
      const fullPath = join(dir, f)
      return statSync(fullPath).isDirectory()
    })
    .map(f => featureToTask(join(dir, f)))
    .filter(Boolean) as Task[]
}

/** Check if a task ID belongs to the supercrew demo (SC- prefix) */
export function isSupercrewTask(id: string): boolean {
  return id.startsWith('SC-')
}

/** Extract the feature-id from a supercrew task ID (SC-user-auth → user-auth) */
function featureIdFromTaskId(id: string): string {
  return id.replace(/^SC-/, '')
}

/** Read a single supercrew feature as a Task */
export function readSupercrewFeature(taskId: string): Task | null {
  const featureId = featureIdFromTaskId(taskId)
  const dir = join(getSupercrewDir(), featureId)
  if (!existsSync(dir)) return null
  return featureToTask(dir)
}

/** Update the status of a supercrew feature by rewriting meta.yaml */
export function updateSupercrewFeatureStatus(taskId: string, kanbanStatus: TaskStatus): Task | null {
  const featureId = featureIdFromTaskId(taskId)
  const dir = join(getSupercrewDir(), featureId)
  const metaPath = join(dir, 'meta.yaml')
  if (!existsSync(metaPath)) return null

  try {
    const raw = readFileSync(metaPath, 'utf8')
    const newSupercrewStatus = REVERSE_STATUS_MAP[kanbanStatus] ?? 'planning'
    const today = new Date().toISOString().split('T')[0]

    // Replace status and updated fields in the YAML text
    let updated = raw.replace(/^status:\s*.+$/m, `status: ${newSupercrewStatus}`)
    updated = updated.replace(/^updated:\s*.+$/m, `updated: "${today}"`)

    writeFileSync(metaPath, updated)

    // Return the updated task
    return featureToTask(dir)
  } catch {
    return null
  }
}
