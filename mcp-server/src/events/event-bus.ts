import { EventEmitter } from 'events'
import type { Feature } from '../types.js'

export type FeatureEvent =
  | { type: 'feature:created'; feature: Feature }
  | { type: 'feature:updated'; feature: Feature }
  | { type: 'feature:deleted'; featureId: string }
  | { type: 'sync:started' }
  | { type: 'sync:completed'; count: number }
  | { type: 'conflict:detected'; featureId: string; local: Feature; remote: Feature }

type EventMap = {
  'feature:created': [feature: Feature]
  'feature:updated': [feature: Feature]
  'feature:deleted': [featureId: string]
  'sync:started': []
  'sync:completed': [count: number]
  'conflict:detected': [featureId: string, local: Feature, remote: Feature]
}

export class EventBus extends EventEmitter {
  constructor() {
    super()
    this.setMaxListeners(20)
  }

  emit<K extends keyof EventMap>(event: K, ...args: EventMap[K]): boolean {
    return super.emit(event, ...args)
  }

  on<K extends keyof EventMap>(event: K, listener: (...args: EventMap[K]) => void): this {
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

  syncStarted(): void {
    this.emit('sync:started')
  }

  syncCompleted(count: number): void {
    this.emit('sync:completed', count)
  }

  conflictDetected(featureId: string, local: Feature, remote: Feature): void {
    this.emit('conflict:detected', featureId, local, remote)
  }

  dispose(): void {
    this.removeAllListeners()
  }
}

export const eventBus = new EventBus()
