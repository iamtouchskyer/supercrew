import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { z } from 'zod'
import type { FeatureStore } from '../store/feature-store.js'
import type { EventBus } from '../events/event-bus.js'
import type { SupercrewStatus } from '../types.js'

// Validation schemas
const SupercrewStatusSchema = z.enum(['planning', 'designing', 'ready', 'active', 'blocked', 'done'])
const PrioritySchema = z.enum(['P0', 'P1', 'P2', 'P3'])

const FeatureInputSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  status: SupercrewStatusSchema.optional(),
  owner: z.string().optional(),
  priority: PrioritySchema.optional(),
  branch: z.string().optional(),
  teams: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
})

const UpdateStatusSchema = z.object({
  status: SupercrewStatusSchema,
})

export function createHttpApp(store: FeatureStore, eventBus: EventBus) {
  const app = new Hono()

  // Error handling middleware
  app.onError((err, c) => {
    console.error('HTTP Error:', err)

    // Handle Zod validation errors
    if (err instanceof z.ZodError) {
      return c.json({
        error: 'Validation failed',
        details: err.errors
      }, 400)
    }

    // Handle other errors
    return c.json({
      error: err.message || 'Internal server error'
    }, 500)
  })

  app.use('*', cors({
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowHeaders: ['Content-Type'],
  }))

  app.get('/health', (c) => c.json({ ok: true }))

  app.get('/api/features', (c) => {
    try {
      const features = store.listAll()
      return c.json(features)
    } catch (error) {
      throw new Error(`Failed to list features: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  })

  app.get('/api/features/:id', (c) => {
    try {
      const feature = store.get(c.req.param('id'))
      if (!feature) return c.json({ error: 'Not found' }, 404)
      return c.json(feature)
    } catch (error) {
      throw new Error(`Failed to get feature: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  })

  app.post('/api/features', async (c) => {
    const body = await c.req.json()
    const validatedInput = FeatureInputSchema.parse(body)

    try {
      const feature = store.create(validatedInput)
      eventBus.featureCreated(feature)
      return c.json(feature, 201)
    } catch (error) {
      throw new Error(`Failed to create feature: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  })

  app.patch('/api/features/:id/status', async (c) => {
    const body = await c.req.json()
    const { status } = UpdateStatusSchema.parse(body)

    try {
      const feature = store.updateStatus(c.req.param('id'), status)
      if (!feature) return c.json({ error: 'Not found' }, 404)
      eventBus.featureUpdated(feature)
      return c.json(feature)
    } catch (error) {
      if (error instanceof Error && error.message.includes('Not found')) {
        return c.json({ error: 'Not found' }, 404)
      }
      throw new Error(`Failed to update feature status: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  })

  app.delete('/api/features/:id', (c) => {
    try {
      const deleted = store.delete(c.req.param('id'))
      if (!deleted) return c.json({ error: 'Not found' }, 404)
      eventBus.featureDeleted(c.req.param('id'))
      return c.json({ ok: true })
    } catch (error) {
      throw new Error(`Failed to delete feature: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  })

  app.get('/api/board', (c) => {
    try {
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
    } catch (error) {
      throw new Error(`Failed to get board: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  })

  return app
}
