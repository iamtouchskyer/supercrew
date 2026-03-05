import { execSync } from 'child_process'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import yaml from 'js-yaml'
import type { Feature } from '../types.js'
import type { EventBus } from '../events/event-bus.js'

interface SyncTask {
  action: 'create' | 'update' | 'delete'
  feature: Feature
}

export class GitHubSyncWorker {
  private queue: SyncTask[] = []
  private syncing = false

  constructor(
    private repoRoot: string,
    private eventBus: EventBus
  ) {}

  queueCreate(feature: Feature) {
    this.queue.push({ action: 'create', feature })
    this.processQueue()
  }

  queueUpdate(feature: Feature) {
    // Dedupe: remove pending updates for same feature
    this.queue = this.queue.filter(t => t.feature.id !== feature.id)
    this.queue.push({ action: 'update', feature })
    this.processQueue()
  }

  queueDelete(feature: Feature) {
    this.queue = this.queue.filter(t => t.feature.id !== feature.id)
    this.queue.push({ action: 'delete', feature })
    this.processQueue()
  }

  async flushAll() {
    while (this.queue.length > 0) {
      await this.processQueue()
    }
  }

  private async processQueue() {
    if (this.syncing || this.queue.length === 0) return

    this.syncing = true
    this.eventBus.syncStarted()

    let count = 0
    while (this.queue.length > 0) {
      const task = this.queue.shift()!
      try {
        await this.executeTask(task)
        count++
      } catch (e) {
        console.error(`Sync failed for ${task.feature.id}:`, e)
      }
    }

    this.eventBus.syncCompleted(count)
    this.syncing = false
  }

  private async executeTask(task: SyncTask) {
    const { feature, action } = task
    const featureDir = join(this.repoRoot, '.supercrew', 'features', feature.id)

    switch (action) {
      case 'create':
      case 'update':
        mkdirSync(featureDir, { recursive: true })
        this.writeFeatureFiles(featureDir, feature)
        this.gitCommit(`feat: ${action} feature ${feature.id}`)
        break

      case 'delete':
        if (existsSync(featureDir)) {
          execSync(`rm -rf "${featureDir}"`, { cwd: this.repoRoot })
          this.gitCommit(`chore: delete feature ${feature.id}`)
        }
        break
    }
  }

  private writeFeatureFiles(dir: string, feature: Feature) {
    // meta.yaml
    const meta = {
      id: feature.id,
      title: feature.title,
      status: feature.status,
      owner: feature.owner,
      priority: feature.priority,
      teams: feature.teams,
      tags: feature.tags,
      blocked_by: feature.blocked_by,
      target_release: feature.target_release,
      created: feature.created_at,
      updated: feature.updated_at,
    }
    writeFileSync(join(dir, 'meta.yaml'), yaml.dump(meta))

    // design.md
    if (feature.design_md) {
      writeFileSync(join(dir, 'design.md'), feature.design_md)
    }

    // plan.md
    if (feature.plan_md) {
      writeFileSync(join(dir, 'plan.md'), feature.plan_md)
    }

    // log.md
    if (feature.log_md) {
      writeFileSync(join(dir, 'log.md'), feature.log_md)
    }
  }

  private gitCommit(message: string) {
    try {
      execSync('git add .supercrew/', { cwd: this.repoRoot })
      execSync(`git commit -m "${message}" --allow-empty`, { cwd: this.repoRoot })
    } catch (e) {
      // Ignore if nothing to commit
    }
  }

  async gitPush() {
    try {
      execSync('git push', { cwd: this.repoRoot })
    } catch (e) {
      console.error('Git push failed:', e)
    }
  }
}
