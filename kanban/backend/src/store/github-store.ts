import matter from 'gray-matter'
import yaml from 'js-yaml'
import type {
  FeatureMeta, DesignDoc, PlanDoc, FeatureLog, Feature, SupercrewStatus,
} from '../types/index.js'

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

function decodeContent(b64: string): string {
  return decodeURIComponent(escape(atob(b64.replace(/\n/g, ''))))
}

// ─── Features (read-only) ─────────────────────────────────────────────────────

const FEATURES_PATH = '.supercrew/features'

/** List all feature directories */
export async function listFeaturesGH(
  token: string, owner: string, repo: string,
): Promise<FeatureMeta[]> {
  const dirs = await ghList(token, owner, repo, FEATURES_PATH)
  if (!dirs) return []
  const featureDirs = dirs.filter(d => d.type === 'dir')
  const metas = await Promise.all(
    featureDirs.map(d => getFeatureMetaGH(token, owner, repo, d.name))
  )
  return metas.filter(Boolean) as FeatureMeta[]
}

/** Read meta.yaml for a single feature */
export async function getFeatureMetaGH(
  token: string, owner: string, repo: string, id: string,
): Promise<FeatureMeta | null> {
  const file = await ghGet(token, owner, repo, `${FEATURES_PATH}/${id}/meta.yaml`)
  if (!file) return null
  const raw = yaml.load(decodeContent(file.content)) as Record<string, any>
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
export async function getFeatureDesignGH(
  token: string, owner: string, repo: string, id: string,
): Promise<DesignDoc | null> {
  const file = await ghGet(token, owner, repo, `${FEATURES_PATH}/${id}/design.md`)
  if (!file) return null
  const { data, content } = matter(decodeContent(file.content))
  return {
    status: data.status ?? 'draft',
    reviewers: data.reviewers ?? [],
    approved_by: data.approved_by,
    body: content.trim(),
  } as DesignDoc
}

/** Read plan.md for a single feature */
export async function getFeaturePlanGH(
  token: string, owner: string, repo: string, id: string,
): Promise<PlanDoc | null> {
  const file = await ghGet(token, owner, repo, `${FEATURES_PATH}/${id}/plan.md`)
  if (!file) return null
  const { data, content } = matter(decodeContent(file.content))
  return {
    total_tasks: data.total_tasks ?? 0,
    completed_tasks: data.completed_tasks ?? 0,
    progress: data.progress ?? 0,
    body: content.trim(),
  } as PlanDoc
}

/** Read log.md for a single feature */
export async function getFeatureLogGH(
  token: string, owner: string, repo: string, id: string,
): Promise<FeatureLog | null> {
  const file = await ghGet(token, owner, repo, `${FEATURES_PATH}/${id}/log.md`)
  if (!file) return null
  return { body: decodeContent(file.content).trim() } as FeatureLog
}

/** Get full feature with all documents */
export async function getFeatureGH(
  token: string, owner: string, repo: string, id: string,
): Promise<Feature | null> {
  const meta = await getFeatureMetaGH(token, owner, repo, id)
  if (!meta) return null
  const [design, plan, log] = await Promise.all([
    getFeatureDesignGH(token, owner, repo, id),
    getFeaturePlanGH(token, owner, repo, id),
    getFeatureLogGH(token, owner, repo, id),
  ])
  return {
    meta,
    design: design ?? undefined,
    plan: plan ?? undefined,
    log: log ?? undefined,
  }
}

/** Check if .supercrew/features/ exists in a repo */
export async function checkSupercrewExistsGH(
  token: string, owner: string, repo: string,
): Promise<boolean> {
  const res = await fetch(
    `${GH_API}/repos/${owner}/${repo}/contents/${FEATURES_PATH}`,
    { headers: ghHeaders(token) },
  )
  return res.ok
}
