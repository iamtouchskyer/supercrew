import { EventEmitter } from 'events'
import type { Feature } from '../types.js'

export type FeatureEvent =
  | { type: 'feature:created'; feature: Feature }
  | { type: 'feature:updated'; feature: Feature }
  | { type: 'feature:deleted'; featureId: string }
  | { type: 'sync:started' }
  | { type: 'sync:completed'; count: number }
  | { type: 'conflict:detected'; featureId: string; local: Feature; remote: Feature }

export class EventBus extends EventEmitter {
  emit(event: FeatureEvent['type'], ...args: any[]): boolean {
    return super.emit(event, ...args)
  }

  on(event: FeatureEvent['type'], listener: (...args: any[]) => void): this {
    return super.on(event, listener)
  }

  featureCreated(feature: Feature): void {
    this.emit('feature:created', feature)
  }

  featureUpdated(feature: Feature): void {
    this.emit('feature:updated', feature)
  }

  featureDeleted(featureId: string): void {
    this.emit('feature:deleted', featureId)
  }

  conflictDetected(featureId: string, local: Feature, remote: Feature): void {
    this.emit('conflict:detected', featureId, local, remote)
  }
}

export const eventBus = new EventBus()
