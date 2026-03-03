// File-based store — reads .supercrew/features/ directory (read-only)
// Used for local development / debug only

import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'
import matter from 'gray-matter'
import yaml from 'js-yaml'
import type {
  FeatureMeta, DesignDoc, PlanDoc, FeatureLog, Feature, SupercrewStatus,
} from '../types/index.js'

// Root of the .supercrew/ directory — resolved relative to the project being managed
function getSupercrewDir(): string {
  return process.env.SUPERCREW_DIR ?? join(process.cwd(), '../..', '.supercrew')
}

const FEATURES_PATH = 'features'

// ─── Features (read-only) ─────────────────────────────────────────────────────

/** List all features from local .supercrew/features/ */
export function listFeatures(): FeatureMeta[] {
  const dir = join(getSupercrewDir(), FEATURES_PATH)
  if (!existsSync(dir)) return []

  return readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => getFeatureMeta(d.name))
    .filter(Boolean) as FeatureMeta[]
}

/** Read meta.yaml for a single feature */
export function getFeatureMeta(id: string): FeatureMeta | null {
  const file = join(getSupercrewDir(), FEATURES_PATH, id, 'meta.yaml')
  if (!existsSync(file)) return null
  const raw = yaml.load(readFileSync(file, 'utf8')) as Record<string, any>
  return {
    id: raw.id ?? id,
    title: raw.title ?? '',
    status: raw.status ?? 'planning',
    owner: raw.owner ?? '',
    priority: raw.priority ?? 'P2',
    teams: raw.teams ?? [],
    target_release: raw.target_release,
    created: raw.created ?? '',
    updated: raw.updated ?? '',
    tags: raw.tags ?? [],
    blocked_by: raw.blocked_by ?? [],
  } as FeatureMeta
}

/** Read design.md for a single feature */
export function getFeatureDesign(id: string): DesignDoc | null {
  const file = join(getSupercrewDir(), FEATURES_PATH, id, 'design.md')
  if (!existsSync(file)) return null
  const { data, content } = matter(readFileSync(file, 'utf8'))
  return {
    status: data.status ?? 'draft',
    reviewers: data.reviewers ?? [],
    approved_by: data.approved_by,
    body: content.trim(),
  } as DesignDoc
}

/** Read plan.md for a single feature */
export function getFeaturePlan(id: string): PlanDoc | null {
  const file = join(getSupercrewDir(), FEATURES_PATH, id, 'plan.md')
  if (!existsSync(file)) return null
  const { data, content } = matter(readFileSync(file, 'utf8'))
  return {
    total_tasks: data.total_tasks ?? 0,
    completed_tasks: data.completed_tasks ?? 0,
    progress: data.progress ?? 0,
    body: content.trim(),
  } as PlanDoc
}

/** Read log.md for a single feature */
export function getFeatureLog(id: string): FeatureLog | null {
  const file = join(getSupercrewDir(), FEATURES_PATH, id, 'log.md')
  if (!existsSync(file)) return null
  return { body: readFileSync(file, 'utf8').trim() } as FeatureLog
}

/** Get full feature with all documents */
export function getFeature(id: string): Feature | null {
  const meta = getFeatureMeta(id)
  if (!meta) return null
  return {
    meta,
    design: getFeatureDesign(id) ?? undefined,
    plan: getFeaturePlan(id) ?? undefined,
    log: getFeatureLog(id) ?? undefined,
  }
}

/** Check if .supercrew/features/ exists locally */
export function checkSupercrewExists(): boolean {
  return existsSync(join(getSupercrewDir(), FEATURES_PATH))
}
