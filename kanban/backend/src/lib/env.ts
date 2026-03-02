// Centralized env-var validation.
// Uses getters so each var is validated on first access — not at import time.
// In production, top-level module code in index.ts / auth.ts accesses these immediately,
// so missing vars still crash at startup. In tests, only the vars actually used get checked.

function required(name: string): string {
  const val = process.env[name]
  if (!val) throw new Error(`Missing required env var: ${name}`)
  return val
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback
}

export const env = {
  get GITHUB_CLIENT_ID()     { return required('GITHUB_CLIENT_ID') },
  get GITHUB_CLIENT_SECRET() { return required('GITHUB_CLIENT_SECRET') },
  get JWT_SECRET()           { return required('JWT_SECRET') },
  get FRONTEND_URL()         { return optional('FRONTEND_URL', 'http://localhost:5173') },
  get BACKEND_URL()          { return optional('BACKEND_URL', 'http://localhost:3001') },
  get PORT()                 { return parseInt(optional('PORT', '3001'), 10) },
  get isVercel()             { return !!process.env.VERCEL },
}
