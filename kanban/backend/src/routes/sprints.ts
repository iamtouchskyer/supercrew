import { Hono } from 'hono'
import { listSprintsGH, writeSprintGH } from '../store/github-store.js'
import { getGitHubContext } from '../lib/get-github-context.js'
import type { UserRegistry } from '../registry/types.js'
import type { Sprint } from '../types/index.js'

export function createSprintsRouter(registry: UserRegistry) {
  const app = new Hono()

  app.get('/', async (c) => {
    try {
      const ctx = await getGitHubContext(c.req.header('Authorization'), registry)
      return c.json(await listSprintsGH(ctx.accessToken, ctx.owner, ctx.repo))
    } catch (e: any) {
      return c.json({ error: e.message }, e.message === 'Unauthorized' ? 401 : 400)
    }
  })

  app.post('/', async (c) => {
    try {
      const ctx = await getGitHubContext(c.req.header('Authorization'), registry)
      const body = await c.req.json<Sprint>()
      await writeSprintGH(ctx.accessToken, ctx.owner, ctx.repo, body)
      return c.json(body, 201)
    } catch (e: any) {
      return c.json({ error: e.message }, e.message === 'Unauthorized' ? 401 : 400)
    }
  })

  app.patch('/:id', async (c) => {
    try {
      const ctx = await getGitHubContext(c.req.header('Authorization'), registry)
      const body = await c.req.json<Partial<Sprint>>()
      const sprints = await listSprintsGH(ctx.accessToken, ctx.owner, ctx.repo)
      const sprint = sprints.find(s => s.id === parseInt(c.req.param('id')))
      if (!sprint) return c.json({ error: 'Not found' }, 404)
      const updated = { ...sprint, ...body }
      await writeSprintGH(ctx.accessToken, ctx.owner, ctx.repo, updated)
      return c.json(updated)
    } catch (e: any) {
      return c.json({ error: e.message }, e.message === 'Unauthorized' ? 401 : 400)
    }
  })

  return app
}
