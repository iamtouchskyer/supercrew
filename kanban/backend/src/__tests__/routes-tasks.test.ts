import { describe, it, expect } from 'vitest'

process.env.GITHUB_CLIENT_ID = 'test-client-id'
process.env.GITHUB_CLIENT_SECRET = 'test-secret'
process.env.JWT_SECRET = 'test-jwt-secret'

const { app } = await import('../index.js')

describe('GET /api/tasks', () => {
  it('returns 401 without auth', async () => {
    const res = await app.request('/api/tasks')
    expect(res.status).toBe(401)
  })
})

describe('GET /api/board', () => {
  it('returns 401 without auth', async () => {
    const res = await app.request('/api/board')
    expect(res.status).toBe(401)
  })
})
