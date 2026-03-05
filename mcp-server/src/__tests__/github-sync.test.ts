import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConflictResolver } from '../sync/conflict-resolver.js'
import { EventBus } from '../events/event-bus.js'
import type { Feature } from '../types.js'

describe('ConflictResolver', () => {
  let resolver: ConflictResolver
  let eventBus: EventBus

  beforeEach(() => {
    eventBus = new EventBus()
    resolver = new ConflictResolver(eventBus)
  })

  it('detects conflict when both local and remote updated after sync', () => {
    const now = Date.now()
    const local: Feature = {
      id: 'f1',
      title: 'Test',
      status: 'active',
      owner: null,
      priority: null,
      branch: 'main',
      teams: [],
      tags: [],
      blocked_by: [],
      target_release: null,
      created_at: new Date(now - 10000).toISOString(),
      updated_at: new Date(now - 1000).toISOString(), // Updated after sync
      meta_yaml: null,
      design_md: null,
      plan_md: null,
      log_md: null,
      synced_at: new Date(now - 5000).toISOString(), // Synced before update
    }

    const remote: Feature = {
      ...local,
      updated_at: new Date(now - 2000).toISOString(), // Also updated after sync
    }

    expect(resolver.detectConflict(local, remote)).toBe(true)
  })

  it('does not detect conflict when only local updated', () => {
    const now = Date.now()
    const local: Feature = {
      id: 'f1',
      title: 'Test',
      status: 'active',
      owner: null,
      priority: null,
      branch: 'main',
      teams: [],
      tags: [],
      blocked_by: [],
      target_release: null,
      created_at: new Date(now - 10000).toISOString(),
      updated_at: new Date(now - 1000).toISOString(),
      meta_yaml: null,
      design_md: null,
      plan_md: null,
      log_md: null,
      synced_at: new Date(now - 5000).toISOString(),
    }

    const remote: Feature = {
      ...local,
      updated_at: new Date(now - 6000).toISOString(), // Updated before sync
    }

    expect(resolver.detectConflict(local, remote)).toBe(false)
  })

  it('registers and resolves conflict with local choice', () => {
    const local = { id: 'f1', title: 'Local' } as Feature
    const remote = { id: 'f1', title: 'Remote' } as Feature

    const handler = vi.fn()
    eventBus.on('conflict:detected', handler)

    resolver.registerConflict(local, remote)

    expect(handler).toHaveBeenCalledWith('f1', local, remote)
    expect(resolver.getPendingConflicts()).toContain('f1')

    const resolved = resolver.resolveConflict('f1', 'local')
    expect(resolved?.title).toBe('Local')
    expect(resolver.getPendingConflicts()).not.toContain('f1')
  })

  it('registers and resolves conflict with remote choice', () => {
    const local = { id: 'f1', title: 'Local' } as Feature
    const remote = { id: 'f1', title: 'Remote' } as Feature

    resolver.registerConflict(local, remote)

    const resolved = resolver.resolveConflict('f1', 'remote')
    expect(resolved?.title).toBe('Remote')
  })
})
