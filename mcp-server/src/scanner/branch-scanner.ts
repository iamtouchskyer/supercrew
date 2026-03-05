import { execSync } from 'child_process'
import { join } from 'path'
import { existsSync, readFileSync, readdirSync } from 'fs'
import type { Feature } from '../types.js'
import { parseMetaYaml } from './feature-parser.js'

export interface ScanResult {
  features: Feature[]
  branches: string[]
}

export class BranchScanner {
  constructor(private repoRoot: string) {}

  async scanAllBranches(): Promise<ScanResult> {
    const branches = this.listBranches()
    const featuresPerBranch = new Map<string, Feature[]>()

    for (const branch of branches) {
      const features = await this.scanBranch(branch)
      featuresPerBranch.set(branch, features)
    }

    const deduped = this.dedupeFeatures(featuresPerBranch)
    return { features: deduped, branches }
  }

  async scanCurrentBranch(): Promise<Feature[]> {
    const branch = this.getCurrentBranch()
    return this.scanBranch(branch)
  }

  private listBranches(): string[] {
    try {
      const output = execSync('git branch -a --format="%(refname:short)"', {
        cwd: this.repoRoot,
        encoding: 'utf-8',
      })
      return output
        .split('\n')
        .map(b => b.trim())
        .filter(b => b && !b.includes('->'))
        .filter(b => b === 'main' || b.startsWith('feature/') || b.startsWith('fix/'))
    } catch {
      return ['main']
    }
  }

  private getCurrentBranch(): string {
    try {
      return execSync('git branch --show-current', {
        cwd: this.repoRoot,
        encoding: 'utf-8',
      }).trim()
    } catch {
      return 'main'
    }
  }

  private async scanBranch(branch: string): Promise<Feature[]> {
    const featuresDir = join(this.repoRoot, '.supercrew', 'features')

    if (!existsSync(featuresDir)) {
      return []
    }

    const features: Feature[] = []

    try {
      const currentBranch = this.getCurrentBranch()
      if (branch === currentBranch) {
        // For current branch, read from filesystem
        const entries = readdirSync(featuresDir)

        for (const entry of entries) {
          const featurePath = join(featuresDir, entry)
          const feature = this.parseFeatureDir(featurePath, entry, branch)
          if (feature) features.push(feature)
        }
      } else {
        // For other branches, use git show
        const featureIds = this.listFeaturesInBranch(branch)
        for (const id of featureIds) {
          const feature = this.parseFeatureFromGit(branch, id)
          if (feature) features.push(feature)
        }
      }
    } catch (e) {
      console.error(`Error scanning branch ${branch}:`, e)
    }

    return features
  }

  private listFeaturesInBranch(branch: string): string[] {
    try {
      const output = execSync(
        `git ls-tree -d --name-only ${branch}:.supercrew/features/ 2>/dev/null || true`,
        { cwd: this.repoRoot, encoding: 'utf-8' }
      )
      return output.split('\n').filter(Boolean)
    } catch {
      return []
    }
  }

  private parseFeatureDir(dirPath: string, featureId: string, branch: string): Feature | null {
    const metaPath = join(dirPath, 'meta.yaml')
    if (!existsSync(metaPath)) return null

    try {
      const metaContent = readFileSync(metaPath, 'utf-8')
      const partial = parseMetaYaml(metaContent, featureId)

      const designPath = join(dirPath, 'design.md')
      const planPath = join(dirPath, 'plan.md')
      const logPath = join(dirPath, 'log.md')

      return {
        ...partial,
        branch,
        design_md: existsSync(designPath) ? readFileSync(designPath, 'utf-8') : null,
        plan_md: existsSync(planPath) ? readFileSync(planPath, 'utf-8') : null,
        log_md: existsSync(logPath) ? readFileSync(logPath, 'utf-8') : null,
        synced_at: null,
      } as Feature
    } catch {
      return null
    }
  }

  private parseFeatureFromGit(branch: string, featureId: string): Feature | null {
    try {
      const metaContent = execSync(
        `git show ${branch}:.supercrew/features/${featureId}/meta.yaml 2>/dev/null`,
        { cwd: this.repoRoot, encoding: 'utf-8' }
      )
      const partial = parseMetaYaml(metaContent, featureId)

      const getFile = (filename: string): string | null => {
        try {
          return execSync(
            `git show ${branch}:.supercrew/features/${featureId}/${filename} 2>/dev/null`,
            { cwd: this.repoRoot, encoding: 'utf-8' }
          )
        } catch {
          return null
        }
      }

      return {
        ...partial,
        branch,
        design_md: getFile('design.md'),
        plan_md: getFile('plan.md'),
        log_md: getFile('log.md'),
        synced_at: null,
      } as Feature
    } catch {
      return null
    }
  }

  private dedupeFeatures(featuresPerBranch: Map<string, Feature[]>): Feature[] {
    const result = new Map<string, Feature>()

    // First add main branch features
    for (const f of featuresPerBranch.get('main') ?? []) {
      result.set(f.id, { ...f, branch: 'main' })
    }

    // Then override with feature/* and fix/* branches (more recent)
    for (const [branch, features] of featuresPerBranch) {
      if (branch.startsWith('feature/') || branch.startsWith('fix/')) {
        for (const f of features) {
          result.set(f.id, { ...f, branch })
        }
      }
    }

    return Array.from(result.values())
  }
}
