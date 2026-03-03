import { Hono } from 'hono'
import { verify } from 'hono/jwt'
import type { UserRegistry } from '../registry/types.js'
import { env } from '../lib/env.js'

async function getPayload(authHeader: string | undefined) {
  if (!authHeader?.startsWith('Bearer ')) {
    console.log('[getPayload] no Bearer header, header was:', authHeader?.substring(0, 20))
    throw new Error('Unauthorized')
  }
  try {
    return await verify(authHeader.slice(7), env.JWT_SECRET, 'HS256') as any
  } catch (e: any) {
    console.log('[getPayload] verify failed:', e?.message, 'JWT_SECRET set:', !!env.JWT_SECRET)
    throw e
  }
}

export function createProjectsRouter(registry: UserRegistry) {
  const app = new Hono()

  // 列出用户项目
  app.get('/', async (c) => {
    try {
      const payload = await getPayload(c.req.header('Authorization'))
      const projects = await registry.listProjects(payload.github_id)
      return c.json(projects)
    } catch { return c.json({ error: 'Unauthorized' }, 401) }
  })

  // 绑定新项目
  app.post('/', async (c) => {
    try {
      const payload = await getPayload(c.req.header('Authorization'))
      const { repo_full_name, repo_url } = await c.req.json()
      const project = await registry.addProject(payload.github_id, { repo_full_name, repo_url })
      return c.json(project, 201)
    } catch (e: any) {
      const status = e.message === 'Unauthorized' ? 401 : 400
      return c.json({ error: e.message }, status)
    }
  })

  // 解绑项目
  app.delete('/:id', async (c) => {
    try {
      const payload = await getPayload(c.req.header('Authorization'))
      await registry.removeProject(payload.github_id, c.req.param('id'))
      return c.json({ ok: true })
    } catch { return c.json({ error: 'Unauthorized' }, 401) }
  })

  // 拉取用户的 GitHub repo 列表
  app.get('/github/repos', async (c) => {
    try {
      const payload = await getPayload(c.req.header('Authorization'))
      const res = await fetch(
        'https://api.github.com/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator,organization_member',
        { headers: { Authorization: `Bearer ${payload.access_token}`, 'User-Agent': 'supercrew-app' } }
      )
      const repos = await res.json()
      console.log('[github/repos] status:', res.status, 'count:', Array.isArray(repos) ? repos.length : repos)
      return c.json(repos)
    } catch { return c.json({ error: 'Unauthorized' }, 401) }
  })

  // 检查 repo 是否已有 .supercrew/features/ 目录
  app.get('/github/repos/:owner/:repo/init-status', async (c) => {
    try {
      const payload = await getPayload(c.req.header('Authorization'))
      const { owner, repo } = c.req.param()
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/.supercrew/features`,
        { headers: { Authorization: `Bearer ${payload.access_token}`, 'User-Agent': 'supercrew-app' } }
      )
      return c.json({ initialized: res.ok })
    } catch { return c.json({ error: 'Unauthorized' }, 401) }
  })

  return app
}
