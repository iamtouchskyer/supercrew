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
