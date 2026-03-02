import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { KVRegistry } from './registry/kv-registry.js'
import { FileRegistry } from './registry/file-registry.js'
import { createAuthRouter } from './routes/auth.js'
import { createProjectsRouter } from './routes/projects.js'
import { createTasksRouter } from './routes/tasks.js'
import { createSprintsRouter } from './routes/sprints.js'
import { createPeopleRouter } from './routes/people.js'
import { createKnowledgeRouter } from './routes/knowledge.js'
import { createDecisionsRouter } from './routes/decisions.js'
import { getGitHubContext } from './lib/get-github-context.js'
import { listTasksGH, listSprintsGH, listPeopleGH } from './store/github-store.js'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Use KV registry on Vercel, file registry locally
const registry = process.env.VERCEL
  ? new KVRegistry()
  : new FileRegistry(join(__dirname, '../../data/users.json'))

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173'
const PORT = parseInt(process.env.PORT ?? '3001', 10)

export const app = new Hono()

app.use('*', cors({
  origin: [FRONTEND_URL, 'http://localhost:5173', 'http://localhost:5174'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

app.route('/auth', createAuthRouter(registry))
app.route('/api/projects', createProjectsRouter(registry))
app.route('/api/tasks', createTasksRouter(registry))
app.route('/api/sprints', createSprintsRouter(registry))
app.route('/api/people', createPeopleRouter(registry))
app.route('/api/knowledge', createKnowledgeRouter(registry))
app.route('/api/decisions', createDecisionsRouter(registry))

// Board: aggregate endpoint
app.get('/api/board', async (c) => {
  try {
    const ctx = await getGitHubContext(c.req.header('Authorization'), registry)
    const [tasks, sprints, people] = await Promise.all([
      listTasksGH(ctx.accessToken, ctx.owner, ctx.repo),
      listSprintsGH(ctx.accessToken, ctx.owner, ctx.repo),
      listPeopleGH(ctx.accessToken, ctx.owner, ctx.repo),
    ])
    return c.json({ tasks, sprints, people })
  } catch (e: any) {
    return c.json({ error: e.message }, e.message === 'Unauthorized' ? 401 : 400)
  }
})

app.get('/health', (c) => c.json({ ok: true }))

// Local dev entry point (Bun)
declare const Bun: any
if (typeof Bun !== 'undefined') {
  console.log(`Backend running on http://localhost:${PORT}`)
  // @ts-ignore
  Bun.serve({ port: PORT, fetch: app.fetch })
}

export default app
