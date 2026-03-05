import { execSync } from 'child_process'
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'fs'
import { join } from 'path'
import yaml from 'js-yaml'
import type { Feature } from '../types.js'
import type { EventBus } from '../events/event-bus.js'

interface SyncTask {
  action: 'create' | 'update' | 'delete'
  feature: Feature
}

/**
 * Validates that a feature ID is safe for use in file paths
 * @param id - The feature ID to validate
 * @returns true if the ID is valid
 */
function isValidFeatureId(id: string): boolean {
  // Only allow alphanumeric characters, hyphens, and underscores
  return /^[a-zA-Z0-9_-]+$/.test(id)
}

/**
 * Sanitizes a git commit message by escaping special characters
 * @param message - The commit message to sanitize
 * @returns A sanitized message safe for use in shell commands
 */
function sanitizeCommitMessage(message: string): string {
  // Remove or escape characters that could break shell commands
  return message.replace(/["'`$\\]/g, '')
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

    // Validate feature ID to prevent path traversal attacks
    if (!isValidFeatureId(feature.id)) {
      throw new Error(`Invalid feature ID: ${feature.id}. Only alphanumeric characters, hyphens, and underscores are allowed.`)
    }

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
          // Use fs.rmSync instead of shell command to prevent command injection
          rmSync(featureDir, { recursive: true, force: true })
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
    writeFileSync(join(dir, 'meta.yaml'), yaml.dump(meta), { encoding: 'utf-8' })

    // design.md
    if (feature.design_md) {
      writeFileSync(join(dir, 'design.md'), feature.design_md, { encoding: 'utf-8' })
    }

    // plan.md
    if (feature.plan_md) {
      writeFileSync(join(dir, 'plan.md'), feature.plan_md, { encoding: 'utf-8' })
    }

    // log.md
    if (feature.log_md) {
      writeFileSync(join(dir, 'log.md'), feature.log_md, { encoding: 'utf-8' })
    }
  }

  private gitCommit(message: string) {
    try {
      const sanitizedMessage = sanitizeCommitMessage(message)
      execSync('git add .supercrew/', { cwd: this.repoRoot })
      execSync(`git commit -m "${sanitizedMessage}" --allow-empty`, { cwd: this.repoRoot })
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
