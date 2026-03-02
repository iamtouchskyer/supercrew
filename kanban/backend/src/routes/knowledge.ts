import { Hono } from 'hono'
import { listKnowledgeGH } from '../store/github-store.js'
import { getGitHubContext } from '../lib/get-github-context.js'
import type { UserRegistry } from '../registry/types.js'

export function createKnowledgeRouter(registry: UserRegistry) {
  const app = new Hono()

  app.get('/', async (c) => {
    try {
      const ctx = await getGitHubContext(c.req.header('Authorization'), registry)
      return c.json(await listKnowledgeGH(ctx.accessToken, ctx.owner, ctx.repo))
    } catch (e: any) {
      return c.json({ error: e.message }, e.message === 'Unauthorized' ? 401 : 400)
    }
  })

  return app
}
