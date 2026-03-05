import type { Database } from 'bun:sqlite'
import type { Feature, FeatureInput, SupercrewStatus } from '../types'

export class FeatureStore {
  private db: Database

  constructor(db: Database) {
    this.db = db
  }

  listAll(): Feature[] {
    const stmt = this.db.query('SELECT * FROM features ORDER BY created_at DESC')
    const rows = stmt.all()
    return rows.map((row: any) => this.rowToFeature(row))
  }

  get(id: string): Feature | null {
    const stmt = this.db.query('SELECT * FROM features WHERE id = ?')
    const row = stmt.get(id)
    if (!row) return null
    return this.rowToFeature(row as any)
  }

  create(input: FeatureInput): Feature {
    const now = new Date().toISOString()
    const feature: Feature = {
      id: input.id,
      title: input.title,
      status: input.status || 'planning',
      owner: input.owner || null,
      priority: input.priority || null,
      branch: input.branch || 'main',
      teams: input.teams || [],
      tags: input.tags || [],
      blocked_by: [],
      target_release: null,
      created_at: now,
      updated_at: now,
      meta_yaml: null,
      design_md: null,
      plan_md: null,
      log_md: null,
      synced_at: null
    }

    const stmt = this.db.query(`
      INSERT INTO features (
        id, title, status, owner, priority, branch, teams, tags, blocked_by,
        target_release, created_at, updated_at, meta_yaml, design_md, plan_md, log_md, synced_at
      ) VALUES (
        $id, $title, $status, $owner, $priority, $branch, $teams, $tags, $blocked_by,
        $target_release, $created_at, $updated_at, $meta_yaml, $design_md, $plan_md, $log_md, $synced_at
      )
    `)
    stmt.run(this.featureToRow(feature))

    return feature
  }

  updateStatus(id: string, status: SupercrewStatus): Feature | null {
    const now = new Date().toISOString()
    const stmt = this.db.query(`
      UPDATE features
      SET status = ?1, updated_at = ?2
      WHERE id = ?3
    `)
    stmt.run(status, now, id)

    return this.get(id)
  }

  updatePlan(id: string, content: string): Feature | null {
    const now = new Date().toISOString()
    const stmt = this.db.query(`
      UPDATE features
      SET plan_md = ?1, updated_at = ?2
      WHERE id = ?3
    `)
    stmt.run(content, now, id)

    return this.get(id)
  }

  appendLog(id: string, entry: string): Feature | null {
    const feature = this.get(id)
    if (!feature) return null

    const now = new Date().toISOString()
    const currentLog = feature.log_md || ''
    const newLog = currentLog ? `${currentLog}\n\n${entry}` : entry

    const stmt = this.db.query(`
      UPDATE features
      SET log_md = ?1, updated_at = ?2
      WHERE id = ?3
    `)
    stmt.run(newLog, now, id)

    return this.get(id)
  }

  delete(id: string): boolean {
    // Check if the feature exists before deleting
    const exists = this.get(id) !== null
    if (!exists) return false

    const stmt = this.db.query('DELETE FROM features WHERE id = ?')
    stmt.run(id)
    return true
  }

  upsertFromGitHub(feature: Feature): void {
    const existing = this.get(feature.id)

    if (existing) {
      const stmt = this.db.query(`
        UPDATE features
        SET title = $title, status = $status, owner = $owner, priority = $priority,
            branch = $branch, teams = $teams, tags = $tags, blocked_by = $blocked_by,
            target_release = $target_release, updated_at = $updated_at,
            meta_yaml = $meta_yaml, design_md = $design_md, plan_md = $plan_md,
            log_md = $log_md, synced_at = $synced_at
        WHERE id = $id
      `)
      stmt.run(this.featureToRow(feature))
    } else {
      const stmt = this.db.query(`
        INSERT INTO features (
          id, title, status, owner, priority, branch, teams, tags, blocked_by,
          target_release, created_at, updated_at, meta_yaml, design_md, plan_md, log_md, synced_at
        ) VALUES (
          $id, $title, $status, $owner, $priority, $branch, $teams, $tags, $blocked_by,
          $target_release, $created_at, $updated_at, $meta_yaml, $design_md, $plan_md, $log_md, $synced_at
        )
      `)
      stmt.run(this.featureToRow(feature))
    }
  }

  private rowToFeature(row: any): Feature {
    return {
      id: row.id,
      title: row.title,
      status: row.status,
      owner: row.owner,
      priority: row.priority,
      branch: row.branch,
      teams: JSON.parse(row.teams),
      tags: JSON.parse(row.tags),
      blocked_by: JSON.parse(row.blocked_by),
      target_release: row.target_release,
      created_at: row.created_at,
      updated_at: row.updated_at,
      meta_yaml: row.meta_yaml,
      design_md: row.design_md,
      plan_md: row.plan_md,
      log_md: row.log_md,
      synced_at: row.synced_at
    }
  }

  private featureToRow(feature: Feature): any {
    return {
      $id: feature.id,
      $title: feature.title,
      $status: feature.status,
      $owner: feature.owner,
      $priority: feature.priority,
      $branch: feature.branch,
      $teams: JSON.stringify(feature.teams),
      $tags: JSON.stringify(feature.tags),
      $blocked_by: JSON.stringify(feature.blocked_by),
      $target_release: feature.target_release,
      $created_at: feature.created_at,
      $updated_at: feature.updated_at,
      $meta_yaml: feature.meta_yaml,
      $design_md: feature.design_md,
      $plan_md: feature.plan_md,
      $log_md: feature.log_md,
      $synced_at: feature.synced_at
    }
  }
}
