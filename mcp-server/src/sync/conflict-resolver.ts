import type { Feature } from '../types.js'
import type { EventBus } from '../events/event-bus.js'

export interface ConflictResolution {
  featureId: string
  choice: 'local' | 'remote'
}

export class ConflictResolver {
  private pendingConflicts: Map<string, { local: Feature; remote: Feature }> = new Map()

  constructor(private eventBus: EventBus) {}

  detectConflict(local: Feature, remote: Feature): boolean {
    // Conflict if both have been updated since last sync
    if (!local.synced_at) return false

    const localUpdated = new Date(local.updated_at).getTime()
    const remoteUpdated = new Date(remote.updated_at).getTime()
    const lastSync = new Date(local.synced_at).getTime()

    return localUpdated > lastSync && remoteUpdated > lastSync
  }

  registerConflict(local: Feature, remote: Feature) {
    this.pendingConflicts.set(local.id, { local, remote })
    this.eventBus.conflictDetected(local.id, local, remote)
  }

  resolveConflict(featureId: string, choice: 'local' | 'remote'): Feature | null {
    const conflict = this.pendingConflicts.get(featureId)
    if (!conflict) return null

    this.pendingConflicts.delete(featureId)
    return choice === 'local' ? conflict.local : conflict.remote
  }

  getPendingConflicts(): string[] {
    return Array.from(this.pendingConflicts.keys())
  }
}
