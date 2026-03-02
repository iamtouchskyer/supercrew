import { Hono } from 'hono'
import { sign, verify } from 'hono/jwt'
import type { UserRegistry } from '../registry/types.js'
import { env } from '../lib/env.js'

const GITHUB_CLIENT_ID = env.GITHUB_CLIENT_ID
const GITHUB_CLIENT_SECRET = env.GITHUB_CLIENT_SECRET
const JWT_SECRET = env.JWT_SECRET
const FRONTEND_URL = env.FRONTEND_URL
const BACKEND_URL = env.BACKEND_URL

export function createAuthRouter(registry: UserRegistry) {
  const app = new Hono()

  // 跳转 GitHub OAuth（标准流程，GitHub 自动处理登录）
  app.get('/github', (c) => {
    const params = new URLSearchParams({
      client_id: GITHUB_CLIENT_ID,
      scope: 'read:user repo',
      redirect_uri: `${BACKEND_URL}/auth/callback`,
    })
    return c.redirect(`https://github.com/login/oauth/authorize?${params}`)
  })

  // GitHub 回调
  app.get('/callback', async (c) => {
    const code = c.req.query('code')
    const ghError = c.req.query('error')
    console.log('[auth/callback]', { code: !!code, error: ghError, url: c.req.url })
    if (!code) return c.redirect(`${FRONTEND_URL}/login?error=${ghError ?? 'no_code'}`)

    // 用 code 换 access_token
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: GITHUB_CLIENT_ID, client_secret: GITHUB_CLIENT_SECRET, code }),
    })
    const { access_token, error } = await tokenRes.json() as any
    if (error || !access_token) return c.redirect(`${FRONTEND_URL}/login?error=token_failed`)

    // 拉取 GitHub 用户信息
    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${access_token}`, 'User-Agent': 'crew' },
    })
    const ghUser = await userRes.json() as any

    // 保存/更新用户
    const existing = await registry.findUser(ghUser.id)
    const user = {
      github_id: ghUser.id,
      login: ghUser.login,
      name: ghUser.name ?? ghUser.login,
      avatar_url: ghUser.avatar_url,
      created_at: existing?.created_at ?? new Date().toISOString(),
      projects: existing?.projects ?? [],
    }
    await registry.saveUser(user)

    // 签发 JWT（30天过期）
    const token = await sign(
      {
        github_id: ghUser.id,
        login: ghUser.login,
        access_token,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
      },
      JWT_SECRET,
      'HS256'
    )

    return c.redirect(`${FRONTEND_URL}/auth/callback?token=${token}`)
  })

  // 获取当前用户信息
  app.get('/me', async (c) => {
    const authHeader = c.req.header('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401)
    try {
      const payload = await verify(authHeader.slice(7), JWT_SECRET, 'HS256') as any
      const user = await registry.findUser(payload.github_id)
      if (!user) return c.json({ error: 'User not found' }, 404)
      // Never expose access_token in response
      const { projects, ...userInfo } = user
      return c.json({ ...userInfo, projects })
    } catch {
      return c.json({ error: 'Invalid token' }, 401)
    }
  })

  return app
}
