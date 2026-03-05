import { describe, it, expect, vi } from 'vitest'
import { EventBus } from '../events/event-bus.js'
import type { Feature } from '../types.js'

describe('EventBus', () => {
  it('emits feature:created event', () => {
    const bus = new EventBus()
    const handler = vi.fn()

    bus.on('feature:created', handler)

    const feature: Feature = {
      id: 'test',
      title: 'Test',
      status: 'planning',
      owner: null,
      priority: null,
      branch: 'main',
      teams: [],
      tags: [],
      blocked_by: [],
      target_release: null,
      created_at: '2026-03-05',
      updated_at: '2026-03-05',
      meta_yaml: null,
      design_md: null,
      plan_md: null,
      log_md: null,
      synced_at: null,
    }

    bus.featureCreated(feature)

    expect(handler).toHaveBeenCalledWith(feature)
  })

  it('emits conflict:detected event', () => {
    const bus = new EventBus()
    const handler = vi.fn()

    bus.on('conflict:detected', handler)

    const local = { id: 'f1' } as Feature
    const remote = { id: 'f1' } as Feature

    bus.conflictDetected('f1', local, remote)

    expect(handler).toHaveBeenCalledWith('f1', local, remote)
  })

  it('emits feature:updated event', () => {
    const bus = new EventBus()
    const handler = vi.fn()
    bus.on('feature:updated', handler)

    const feature = { id: 'test' } as Feature
    bus.featureUpdated(feature)

    expect(handler).toHaveBeenCalledWith(feature)
  })

  it('emits feature:deleted event', () => {
    const bus = new EventBus()
    const handler = vi.fn()
    bus.on('feature:deleted', handler)

    bus.featureDeleted('test-id')

    expect(handler).toHaveBeenCalledWith('test-id')
  })

  it('emits sync:started event', () => {
    const bus = new EventBus()
    const handler = vi.fn()
    bus.on('sync:started', handler)

    bus.syncStarted()

    expect(handler).toHaveBeenCalledWith()
  })

  it('emits sync:completed event', () => {
    const bus = new EventBus()
    const handler = vi.fn()
    bus.on('sync:completed', handler)

    bus.syncCompleted(5)

    expect(handler).toHaveBeenCalledWith(5)
  })

  it('cleans up listeners with dispose', () => {
    const bus = new EventBus()
    const handler = vi.fn()
    bus.on('feature:created', handler)

    bus.dispose()

    const feature = { id: 'test' } as Feature
    bus.featureCreated(feature)

    expect(handler).not.toHaveBeenCalled()
  })
})
