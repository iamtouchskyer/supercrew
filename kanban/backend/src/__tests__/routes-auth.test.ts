import { describe, it, expect } from 'vitest'

// Set required env vars BEFORE importing app
process.env.GITHUB_CLIENT_ID = 'test-client-id'
process.env.GITHUB_CLIENT_SECRET = 'test-secret'
process.env.JWT_SECRET = 'test-jwt-secret'

const { app } = await import('../index.js')

describe('GET /auth/github', () => {
  it('redirects to GitHub login', async () => {
    const res = await app.request('/auth/github')
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toContain('github.com/login')
  })
})

describe('GET /auth/me', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await app.request('/auth/me')
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 401 with invalid token', async () => {
    const res = await app.request('/auth/me', {
      headers: { Authorization: 'Bearer invalid-token' },
    })
    expect(res.status).toBe(401)
  })
})

describe('GET /health', () => {
  it('returns ok', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })
})
