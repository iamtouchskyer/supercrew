import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { FeatureStore } from '../store/feature-store.js'
import type { EventBus } from '../events/event-bus.js'
import type { SupercrewStatus } from '../types.js'

export function createHttpApp(store: FeatureStore, eventBus: EventBus) {
  const app = new Hono()

  app.use('*', cors({
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowHeaders: ['Content-Type'],
  }))

  app.get('/health', (c) => c.json({ ok: true }))

  app.get('/api/features', (c) => {
    const features = store.listAll()
    return c.json(features)
  })

  app.get('/api/features/:id', (c) => {
    const feature = store.get(c.req.param('id'))
    if (!feature) return c.json({ error: 'Not found' }, 404)
    return c.json(feature)
  })

  app.post('/api/features', async (c) => {
    const body = await c.req.json()
    const feature = store.create(body)
    eventBus.featureCreated(feature)
    return c.json(feature, 201)
  })

  app.patch('/api/features/:id/status', async (c) => {
    const { status } = await c.req.json() as { status: SupercrewStatus }
    const feature = store.updateStatus(c.req.param('id'), status)
    if (!feature) return c.json({ error: 'Not found' }, 404)
    eventBus.featureUpdated(feature)
    return c.json(feature)
  })

  app.delete('/api/features/:id', (c) => {
    const deleted = store.delete(c.req.param('id'))
    if (!deleted) return c.json({ error: 'Not found' }, 404)
    eventBus.featureDeleted(c.req.param('id'))
    return c.json({ ok: true })
  })

  app.get('/api/board', (c) => {
    const features = store.listAll()
    const featuresByStatus = {
      planning: features.filter(f => f.status === 'planning'),
      designing: features.filter(f => f.status === 'designing'),
      ready: features.filter(f => f.status === 'ready'),
      active: features.filter(f => f.status === 'active'),
      blocked: features.filter(f => f.status === 'blocked'),
      done: features.filter(f => f.status === 'done'),
    }
    return c.json({ features, featuresByStatus })
  })

  return app
}
