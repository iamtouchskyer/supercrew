// Mirror of backend types — keep in sync with kanban/backend/src/types/index.ts

export type SupercrewStatus = 'planning' | 'designing' | 'ready' | 'active' | 'blocked' | 'done'
export type FeaturePriority = 'P0' | 'P1' | 'P2' | 'P3'
export type DesignStatus = 'draft' | 'in-review' | 'approved' | 'rejected'

export interface FeatureMeta {
  id: string
  title: string
  status: SupercrewStatus
  owner: string
  priority: FeaturePriority
  teams?: string[]
  target_release?: string
  created: string
  updated: string
  tags?: string[]
  blocked_by?: string[]
}

export interface DesignDoc {
  status: DesignStatus
  reviewers: string[]
  approved_by?: string
  body: string
}

export interface PlanDoc {
  total_tasks: number
  completed_tasks: number
  progress: number
  body: string
}

export interface FeatureLog {
  body: string
}

export interface Feature {
  meta: FeatureMeta
  design?: DesignDoc
  plan?: PlanDoc
  log?: FeatureLog
}

export interface FeatureBoard {
  features: FeatureMeta[]
  featuresByStatus: Record<SupercrewStatus, FeatureMeta[]>
}
