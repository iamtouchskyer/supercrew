import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { Database } from 'bun:sqlite'
import { createDb } from '../store/db.js'
import { FeatureStore } from '../store/feature-store.js'
import { EventBus } from '../events/event-bus.js'
import { createHttpApp } from '../http/routes.js'

describe('Integration: HTTP API', () => {
  let db: Database
  let store: FeatureStore
  let eventBus: EventBus
  let app: ReturnType<typeof createHttpApp>

  beforeEach(() => {
    db = createDb(':memory:')
    store = new FeatureStore(db)
    eventBus = new EventBus()
    app = createHttpApp(store, eventBus)
  })

  afterEach(() => {
    db.close()
    eventBus.dispose()
  })

  it('creates and retrieves feature via API', async () => {
    // Create
    const createRes = await app.request('/api/features', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'test-api', title: 'API Test' }),
    })
    expect(createRes.status).toBe(201)

    // List
    const listRes = await app.request('/api/features')
    const features = await listRes.json()
    expect(features.length).toBe(1)
    expect(features[0].id).toBe('test-api')

    // Get single
    const getRes = await app.request('/api/features/test-api')
    const feature = await getRes.json()
    expect(feature.title).toBe('API Test')
  })

  it('updates feature status', async () => {
    store.create({ id: 'f1', title: 'Feature 1' })

    const res = await app.request('/api/features/f1/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    })

    expect(res.status).toBe(200)
    const updated = await res.json()
    expect(updated.status).toBe('active')
  })

  it('returns board aggregation', async () => {
    store.create({ id: 'f1', title: 'F1', status: 'planning' })
    store.create({ id: 'f2', title: 'F2', status: 'active' })

    const res = await app.request('/api/board')
    const board = await res.json()

    expect(board.featuresByStatus.planning.length).toBe(1)
    expect(board.featuresByStatus.active.length).toBe(1)
  })

  it('returns 404 for non-existent feature', async () => {
    const res = await app.request('/api/features/non-existent')
    expect(res.status).toBe(404)
  })

  it('deletes a feature', async () => {
    store.create({ id: 'to-delete', title: 'To Delete' })

    const deleteRes = await app.request('/api/features/to-delete', {
      method: 'DELETE',
    })
    expect(deleteRes.status).toBe(200)

    const getRes = await app.request('/api/features/to-delete')
    expect(getRes.status).toBe(404)
  })

  it('health check returns ok', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
  })

  it('returns 400 for invalid feature input', async () => {
    const res = await app.request('/api/features', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invalid: 'data' }), // Missing required fields
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid status update', async () => {
    store.create({ id: 'f1', title: 'F1' })

    const res = await app.request('/api/features/f1/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'invalid-status' }),
    })
    expect(res.status).toBe(400)
  })
})
