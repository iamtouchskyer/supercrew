import { verify } from 'hono/jwt'
import type { UserRegistry } from '../registry/types.js'
import { env } from './env.js'

export interface GitHubContext {
  accessToken: string
  githubId: number
  owner: string
  repo: string
  repoFullName: string
}

export async function getGitHubContext(
  authHeader: string | undefined,
  registry: UserRegistry,
): Promise<GitHubContext> {
  if (!authHeader?.startsWith('Bearer ')) throw new Error('Unauthorized')

  const secret = env.JWT_SECRET
  const payload = await verify(authHeader.slice(7), secret, 'HS256').catch(() => {
    throw new Error('Unauthorized')
  }) as any

  const projects = await registry.listProjects(payload.github_id)
  if (!projects.length) throw new Error('NoProject')

  const [owner, repo] = projects[0].repo_full_name.split('/')
  return {
    accessToken: payload.access_token,
    githubId: payload.github_id,
    owner,
    repo,
    repoFullName: projects[0].repo_full_name,
  }
}
