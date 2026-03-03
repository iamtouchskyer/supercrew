import { Hono } from 'hono'
import { listTasksGH, readTaskGH, writeTaskGH, deleteTaskGH } from '../store/github-store.js'
import { getGitHubContext } from '../lib/get-github-context.js'
import { isSupercrewTask, readSupercrewFeature, updateSupercrewFeatureStatus, isSupcrewDemoEnabled } from '../store/supercrew-store.js'
import type { UserRegistry } from '../registry/types.js'
import type { Task, TaskStatus } from '../types/index.js'

export function createTasksRouter(registry: UserRegistry) {
  const app = new Hono()

  app.get('/', async (c) => {
    try {
      const ctx = await getGitHubContext(c.req.header('Authorization'), registry)
      const tasks = await listTasksGH(ctx.accessToken, ctx.owner, ctx.repo)
      return c.json(tasks)
    } catch (e: any) {
      return c.json({ error: e.message }, e.message === 'Unauthorized' ? 401 : 400)
    }
  })

  app.get('/:id', async (c) => {
    const id = c.req.param('id')
    // Handle supercrew demo features
    if (isSupcrewDemoEnabled() && isSupercrewTask(id)) {
      const task = readSupercrewFeature(id)
      if (!task) return c.json({ error: 'Not found' }, 404)
      return c.json(task)
    }
    try {
      const ctx = await getGitHubContext(c.req.header('Authorization'), registry)
      const task = await readTaskGH(ctx.accessToken, ctx.owner, ctx.repo, id)
      if (!task) return c.json({ error: 'Not found' }, 404)
      return c.json(task)
    } catch (e: any) {
      return c.json({ error: e.message }, e.message === 'Unauthorized' ? 401 : 400)
    }
  })

  app.post('/', async (c) => {
    try {
      const ctx = await getGitHubContext(c.req.header('Authorization'), registry)
      const body = await c.req.json<Partial<Task>>()
      if (!body.id || !body.title) return c.json({ error: 'id and title are required' }, 400)
      const existing = await readTaskGH(ctx.accessToken, ctx.owner, ctx.repo, body.id)
      if (existing) return c.json({ error: `Task ${body.id} already exists` }, 409)
      const task: Task = {
        id: body.id,
        title: body.title,
        status: body.status ?? 'backlog',
        priority: body.priority ?? 'P2',
        assignee: body.assignee,
        team: body.team,
        sprint: body.sprint,
        created: new Date().toISOString().split('T')[0],
        updated: new Date().toISOString().split('T')[0],
        tags: body.tags ?? [],
        blocks: body.blocks ?? [],
        blocked_by: body.blocked_by ?? [],
        plan_doc: body.plan_doc,
        pr_url: body.pr_url,
        body: body.body ?? '',
      }
      await writeTaskGH(ctx.accessToken, ctx.owner, ctx.repo, task)
      return c.json(task, 201)
    } catch (e: any) {
      return c.json({ error: e.message }, e.message === 'Unauthorized' ? 401 : 400)
    }
  })

  app.patch('/:id', async (c) => {
    try {
      const ctx = await getGitHubContext(c.req.header('Authorization'), registry)
      const id = c.req.param('id')
      const existing = await readTaskGH(ctx.accessToken, ctx.owner, ctx.repo, id)
      if (!existing) return c.json({ error: 'Not found' }, 404)
      const body = await c.req.json<Partial<Task>>()
      const updated: Task = { ...existing, ...body, id }
      await writeTaskGH(ctx.accessToken, ctx.owner, ctx.repo, updated)
      return c.json(updated)
    } catch (e: any) {
      return c.json({ error: e.message }, e.message === 'Unauthorized' ? 401 : 400)
    }
  })

  app.put('/:id/status', async (c) => {
    const id = c.req.param('id')
    const { status } = await c.req.json<{ status: TaskStatus }>()
    // Handle supercrew demo features — write back to meta.yaml
    if (isSupcrewDemoEnabled() && isSupercrewTask(id)) {
      const updated = updateSupercrewFeatureStatus(id, status)
      if (!updated) return c.json({ error: 'Not found' }, 404)
      return c.json(updated)
    }
    try {
      const ctx = await getGitHubContext(c.req.header('Authorization'), registry)
      const existing = await readTaskGH(ctx.accessToken, ctx.owner, ctx.repo, id)
      if (!existing) return c.json({ error: 'Not found' }, 404)
      const updated = { ...existing, status }
      await writeTaskGH(ctx.accessToken, ctx.owner, ctx.repo, updated)
      return c.json(updated)
    } catch (e: any) {
      return c.json({ error: e.message }, e.message === 'Unauthorized' ? 401 : 400)
    }
  })

  app.delete('/:id', async (c) => {
    try {
      const ctx = await getGitHubContext(c.req.header('Authorization'), registry)
      const deleted = await deleteTaskGH(ctx.accessToken, ctx.owner, ctx.repo, c.req.param('id'))
      if (!deleted) return c.json({ error: 'Not found' }, 404)
      return c.json({ ok: true })
    } catch (e: any) {
      return c.json({ error: e.message }, e.message === 'Unauthorized' ? 401 : 400)
    }
  })

  return app
}
