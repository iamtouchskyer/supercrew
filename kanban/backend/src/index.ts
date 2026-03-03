import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { KVRegistry } from './registry/kv-registry.js'
import { FileRegistry } from './registry/file-registry.js'
import { createAuthRouter } from './routes/auth.js'
import { createProjectsRouter } from './routes/projects.js'
import { createFeaturesRouter, buildFeatureBoard } from './routes/features.js'
import { getGitHubContext } from './lib/get-github-context.js'
import { listFeaturesGH } from './store/github-store.js'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { env } from './lib/env.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Use KV registry on Vercel, file registry locally
const registry = env.isVercel
  ? new KVRegistry()
  : new FileRegistry(join(__dirname, '../../data/users.json'))

const FRONTEND_URL = env.FRONTEND_URL
const PORT = env.PORT

export const app = new Hono()

app.use('*', cors({
  origin: [FRONTEND_URL, 'http://localhost:5173', 'http://localhost:5174'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

app.route('/auth', createAuthRouter(registry))
app.route('/api/projects', createProjectsRouter(registry))
app.route('/api/features', createFeaturesRouter(registry))

// Board: aggregate endpoint — features grouped by status
app.get('/api/board', async (c) => {
  try {
    const ctx = await getGitHubContext(c.req.header('Authorization'), registry)
    const features = await listFeaturesGH(ctx.accessToken, ctx.owner, ctx.repo)
    return c.json(buildFeatureBoard(features))
  } catch (e: any) {
    return c.json({ error: e.message }, e.message === 'Unauthorized' ? 401 : 400)
  }
})

app.get('/health', (c) => c.json({ ok: true }))

// Bun auto-serves when it sees a default export with { port, fetch }
declare const Bun: any
export default {
  port: PORT,
  fetch: app.fetch,
}
