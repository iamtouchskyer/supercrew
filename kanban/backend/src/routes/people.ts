import { Hono } from 'hono'
import { listPeopleGH, readPersonGH, writePersonGH } from '../store/github-store.js'
import { getGitHubContext } from '../lib/get-github-context.js'
import type { UserRegistry } from '../registry/types.js'
import type { Person } from '../types/index.js'

export function createPeopleRouter(registry: UserRegistry) {
  const app = new Hono()

  app.get('/', async (c) => {
    try {
      const ctx = await getGitHubContext(c.req.header('Authorization'), registry)
      return c.json(await listPeopleGH(ctx.accessToken, ctx.owner, ctx.repo))
    } catch (e: any) {
      return c.json({ error: e.message }, e.message === 'Unauthorized' ? 401 : 400)
    }
  })

  app.get('/:username', async (c) => {
    try {
      const ctx = await getGitHubContext(c.req.header('Authorization'), registry)
      const person = await readPersonGH(ctx.accessToken, ctx.owner, ctx.repo, c.req.param('username'))
      if (!person) return c.json({ error: 'Not found' }, 404)
      return c.json(person)
    } catch (e: any) {
      return c.json({ error: e.message }, e.message === 'Unauthorized' ? 401 : 400)
    }
  })

  app.post('/', async (c) => {
    try {
      const ctx = await getGitHubContext(c.req.header('Authorization'), registry)
      const body = await c.req.json<Partial<Person>>()
      if (!body.username) return c.json({ error: 'username is required' }, 400)
      const existing = await readPersonGH(ctx.accessToken, ctx.owner, ctx.repo, body.username)
      if (existing) return c.json({ error: `Person ${body.username} already exists` }, 409)
      const person: Person = {
        username: body.username,
        name: body.name ?? body.username,
        team: body.team ?? '',
        updated: new Date().toISOString().split('T')[0],
        current_task: body.current_task,
        blocked_by: body.blocked_by,
        completed_today: body.completed_today ?? [],
        body: body.body ?? '',
      }
      await writePersonGH(ctx.accessToken, ctx.owner, ctx.repo, person)
      return c.json(person, 201)
    } catch (e: any) {
      return c.json({ error: e.message }, e.message === 'Unauthorized' ? 401 : 400)
    }
  })

  app.patch('/:username', async (c) => {
    try {
      const ctx = await getGitHubContext(c.req.header('Authorization'), registry)
      const username = c.req.param('username')
      const existing = await readPersonGH(ctx.accessToken, ctx.owner, ctx.repo, username)
      if (!existing) return c.json({ error: 'Not found' }, 404)
      const body = await c.req.json<Partial<Person>>()
      const updated = { ...existing, ...body, username }
      await writePersonGH(ctx.accessToken, ctx.owner, ctx.repo, updated)
      return c.json(updated)
    } catch (e: any) {
      return c.json({ error: e.message }, e.message === 'Unauthorized' ? 401 : 400)
    }
  })

  return app
}
