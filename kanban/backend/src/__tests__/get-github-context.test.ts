import { describe, it, expect, vi } from 'vitest'
import { sign } from 'hono/jwt'

const JWT_SECRET = 'test-secret'
process.env.JWT_SECRET = JWT_SECRET

const mockRegistry = {
  listProjects: vi.fn(),
}

vi.mock('../registry/file-registry.js', () => ({ FileRegistry: vi.fn(() => mockRegistry) }))

import { getGitHubContext } from '../lib/get-github-context.js'

describe('getGitHubContext', () => {
  it('throws Unauthorized when no Bearer token', async () => {
    await expect(getGitHubContext(undefined, mockRegistry as any)).rejects.toThrow('Unauthorized')
  })

  it('throws NoProject when user has no projects', async () => {
    const token = await sign({ github_id: 1, login: 'test', access_token: 'ghp_x', exp: 9999999999 }, JWT_SECRET, 'HS256')
    mockRegistry.listProjects.mockResolvedValueOnce([])
    await expect(getGitHubContext(`Bearer ${token}`, mockRegistry as any)).rejects.toThrow('NoProject')
  })

  it('returns context when user has a project', async () => {
    const token = await sign({ github_id: 1, login: 'test', access_token: 'ghp_x', exp: 9999999999 }, JWT_SECRET, 'HS256')
    mockRegistry.listProjects.mockResolvedValueOnce([{ repo_full_name: 'owner/repo', id: 'proj_1', added_at: '', last_visited: '', repo_url: '' }])
    const ctx = await getGitHubContext(`Bearer ${token}`, mockRegistry as any)
    expect(ctx.accessToken).toBe('ghp_x')
    expect(ctx.owner).toBe('owner')
    expect(ctx.repo).toBe('repo')
  })
})
