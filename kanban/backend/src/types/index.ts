// ─── SuperCrew Feature-Centric Types ──────────────────────────────────────────
// Data lives in .supercrew/features/ as YAML/MD files in the user's repo

export type SupercrewStatus = 'planning' | 'designing' | 'ready' | 'active' | 'blocked' | 'done'
export type FeaturePriority = 'P0' | 'P1' | 'P2' | 'P3'
export type DesignStatus = 'draft' | 'in-review' | 'approved' | 'rejected'

/** meta.yaml — feature metadata */
export interface FeatureMeta {
  id: string
  title: string
  status: SupercrewStatus
  owner: string
  priority: FeaturePriority
  teams?: string[]
  target_release?: string
  created: string           // ISO date
  updated: string           // ISO date
  tags?: string[]
  blocked_by?: string[]
}

/** design.md — frontmatter + markdown body */
export interface DesignDoc {
  status: DesignStatus
  reviewers: string[]
  approved_by?: string
  body: string              // markdown body
}

/** plan.md — frontmatter + tasks breakdown markdown */
export interface PlanDoc {
  total_tasks: number
  completed_tasks: number
  progress: number          // 0–100
  body: string              // markdown body with task checklist
}

/** log.md — pure markdown */
export interface FeatureLog {
  body: string              // markdown content
}

/** Aggregated feature for API responses */
export interface Feature {
  meta: FeatureMeta
  design?: DesignDoc
  plan?: PlanDoc
  log?: FeatureLog
}

/** Board response — features grouped by status */
export interface FeatureBoard {
  features: FeatureMeta[]
  featuresByStatus: Record<SupercrewStatus, FeatureMeta[]>
}
