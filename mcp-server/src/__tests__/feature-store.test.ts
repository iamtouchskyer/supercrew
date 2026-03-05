import { describe, it, expect, beforeEach } from 'vitest'
import { createDb } from '../store/db'
import { FeatureStore } from '../store/feature-store'
import type { FeatureInput } from '../types'

describe('FeatureStore', () => {
  let store: FeatureStore

  beforeEach(() => {
    // Use in-memory database for tests
    const db = createDb(':memory:')
    store = new FeatureStore(db)
  })

  it('creates and retrieves a feature', () => {
    const input: FeatureInput = {
      id: 'test-feature-1',
      title: 'Test Feature',
      status: 'planning',
      owner: 'alice',
      priority: 'P1',
      branch: 'feature/test',
      teams: ['frontend', 'backend'],
      tags: ['enhancement']
    }

    const created = store.create(input)

    expect(created.id).toBe('test-feature-1')
    expect(created.title).toBe('Test Feature')
    expect(created.status).toBe('planning')
    expect(created.owner).toBe('alice')
    expect(created.priority).toBe('P1')
    expect(created.branch).toBe('feature/test')
    expect(created.teams).toEqual(['frontend', 'backend'])
    expect(created.tags).toEqual(['enhancement'])
    expect(created.blocked_by).toEqual([])
    expect(created.created_at).toBeTruthy()
    expect(created.updated_at).toBeTruthy()

    const retrieved = store.get('test-feature-1')
    expect(retrieved).toEqual(created)
  })

  it('lists all features', () => {
    store.create({ id: 'feature-1', title: 'Feature One' })
    store.create({ id: 'feature-2', title: 'Feature Two' })
    store.create({ id: 'feature-3', title: 'Feature Three' })

    const all = store.listAll()
    expect(all).toHaveLength(3)
    expect(all.map(f => f.id)).toContain('feature-1')
    expect(all.map(f => f.id)).toContain('feature-2')
    expect(all.map(f => f.id)).toContain('feature-3')
  })

  it('updates feature status', () => {
    store.create({ id: 'feature-1', title: 'Feature One', status: 'planning' })

    const updated = store.updateStatus('feature-1', 'active')
    expect(updated).toBeTruthy()
    expect(updated?.status).toBe('active')

    const retrieved = store.get('feature-1')
    expect(retrieved?.status).toBe('active')
  })

  it('updates feature plan', () => {
    store.create({ id: 'feature-1', title: 'Feature One' })

    const planContent = '## Plan\n\n1. Step one\n2. Step two'
    const updated = store.updatePlan('feature-1', planContent)

    expect(updated).toBeTruthy()
    expect(updated?.plan_md).toBe(planContent)

    const retrieved = store.get('feature-1')
    expect(retrieved?.plan_md).toBe(planContent)
  })

  it('appends to log', () => {
    store.create({ id: 'feature-1', title: 'Feature One' })

    const entry1 = '2024-01-01: Started implementation'
    store.appendLog('feature-1', entry1)

    let feature = store.get('feature-1')
    expect(feature?.log_md).toBe(entry1)

    const entry2 = '2024-01-02: Completed testing'
    store.appendLog('feature-1', entry2)

    feature = store.get('feature-1')
    expect(feature?.log_md).toBe(`${entry1}\n\n${entry2}`)
  })

  it('deletes a feature', () => {
    store.create({ id: 'feature-1', title: 'Feature One' })

    expect(store.get('feature-1')).toBeTruthy()

    const deleted = store.delete('feature-1')
    expect(deleted).toBe(true)

    expect(store.get('feature-1')).toBeNull()
  })

  it('returns null when getting non-existent feature', () => {
    const feature = store.get('non-existent')
    expect(feature).toBeNull()
  })

  it('returns null when updating non-existent feature', () => {
    const updated = store.updateStatus('non-existent', 'active')
    expect(updated).toBeNull()
  })

  it('returns false when deleting non-existent feature', () => {
    const deleted = store.delete('non-existent')
    expect(deleted).toBe(false)
  })

  it('upserts from GitHub - creates new feature', () => {
    const feature = {
      id: 'github-feature-1',
      title: 'GitHub Feature',
      status: 'ready' as const,
      owner: 'bob',
      priority: 'P2' as const,
      branch: 'feature/github',
      teams: ['platform'],
      tags: ['sync'],
      blocked_by: [],
      target_release: 'v1.0',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      meta_yaml: 'key: value',
      design_md: '## Design',
      plan_md: '## Plan',
      log_md: '## Log',
      synced_at: new Date().toISOString()
    }

    store.upsertFromGitHub(feature)

    const retrieved = store.get('github-feature-1')
    expect(retrieved).toBeTruthy()
    expect(retrieved?.title).toBe('GitHub Feature')
    expect(retrieved?.status).toBe('ready')
  })

  it('upserts from GitHub - updates existing feature', () => {
    store.create({ id: 'feature-1', title: 'Original Title', status: 'planning' })

    const updated = {
      id: 'feature-1',
      title: 'Updated Title',
      status: 'active' as const,
      owner: 'charlie',
      priority: 'P0' as const,
      branch: 'main',
      teams: ['ops'],
      tags: ['urgent'],
      blocked_by: [],
      target_release: 'v2.0',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      meta_yaml: null,
      design_md: null,
      plan_md: '## Updated Plan',
      log_md: null,
      synced_at: new Date().toISOString()
    }

    store.upsertFromGitHub(updated)

    const retrieved = store.get('feature-1')
    expect(retrieved?.title).toBe('Updated Title')
    expect(retrieved?.status).toBe('active')
    expect(retrieved?.owner).toBe('charlie')
    expect(retrieved?.plan_md).toBe('## Updated Plan')
  })

  it('handles features with default values', () => {
    const input: FeatureInput = {
      id: 'minimal-feature',
      title: 'Minimal Feature'
    }

    const created = store.create(input)

    expect(created.status).toBe('planning')
    expect(created.owner).toBeNull()
    expect(created.priority).toBeNull()
    expect(created.branch).toBe('main')
    expect(created.teams).toEqual([])
    expect(created.tags).toEqual([])
    expect(created.blocked_by).toEqual([])
  })
})
