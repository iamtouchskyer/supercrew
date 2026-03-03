import { Hono } from 'hono'
import {
  listFeaturesGH,
  getFeatureMetaGH,
  getFeatureGH,
  getFeatureDesignGH,
  getFeaturePlanGH,
} from '../store/github-store.js'
import { getGitHubContext } from '../lib/get-github-context.js'
import type { UserRegistry } from '../registry/types.js'
import type { SupercrewStatus } from '../types/index.js'

const ALL_STATUSES: SupercrewStatus[] = [
  'planning', 'designing', 'ready', 'active', 'blocked', 'done',
]

export function createFeaturesRouter(registry: UserRegistry) {
  const app = new Hono()

  // GET /api/features — list all features (meta summary)
  app.get('/', async (c) => {
    try {
      const ctx = await getGitHubContext(c.req.header('Authorization'), registry)
      const features = await listFeaturesGH(ctx.accessToken, ctx.owner, ctx.repo)
      return c.json(features)
    } catch (e: any) {
      return c.json({ error: e.message }, e.message === 'Unauthorized' ? 401 : 400)
    }
  })

  // GET /api/features/:id — get single feature complete info
  app.get('/:id', async (c) => {
    try {
      const ctx = await getGitHubContext(c.req.header('Authorization'), registry)
      const feature = await getFeatureGH(ctx.accessToken, ctx.owner, ctx.repo, c.req.param('id'))
      if (!feature) return c.json({ error: 'Not found' }, 404)
      return c.json(feature)
    } catch (e: any) {
      return c.json({ error: e.message }, e.message === 'Unauthorized' ? 401 : 400)
    }
  })

  // GET /api/features/:id/design — get design.md
  app.get('/:id/design', async (c) => {
    try {
      const ctx = await getGitHubContext(c.req.header('Authorization'), registry)
      const design = await getFeatureDesignGH(ctx.accessToken, ctx.owner, ctx.repo, c.req.param('id'))
      if (!design) return c.json({ error: 'Not found' }, 404)
      return c.json(design)
    } catch (e: any) {
      return c.json({ error: e.message }, e.message === 'Unauthorized' ? 401 : 400)
    }
  })

  // GET /api/features/:id/plan — get plan.md (with progress)
  app.get('/:id/plan', async (c) => {
    try {
      const ctx = await getGitHubContext(c.req.header('Authorization'), registry)
      const plan = await getFeaturePlanGH(ctx.accessToken, ctx.owner, ctx.repo, c.req.param('id'))
      if (!plan) return c.json({ error: 'Not found' }, 404)
      return c.json(plan)
    } catch (e: any) {
      return c.json({ error: e.message }, e.message === 'Unauthorized' ? 401 : 400)
    }
  })

  return app
}

/** Build board aggregate — features grouped by status */
export function buildFeatureBoard(features: import('../types/index.js').FeatureMeta[]) {
  const featuresByStatus: Record<SupercrewStatus, import('../types/index.js').FeatureMeta[]> = {
    planning: [], designing: [], ready: [], active: [], blocked: [], done: [],
  }
  for (const f of features) {
    if (featuresByStatus[f.status]) {
      featuresByStatus[f.status].push(f)
    }
  }
  return { features, featuresByStatus }
}
