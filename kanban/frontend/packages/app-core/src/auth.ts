const TOKEN_KEY = 'kanban_jwt'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export function isAuthenticated(): boolean {
  const token = getToken()
  if (!token) return false
  try {
    // JWT uses base64url encoding — replace URL-safe chars before atob()
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(b64))
    return payload.exp > Date.now() / 1000
  } catch { return false }
}

export function authHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/**
 * Server-side token verification via /auth/me.
 * Returns true if the token is valid (signature + expiry), false otherwise.
 * On failure, automatically clears the invalid token from localStorage.
 */
export async function verifyToken(): Promise<boolean> {
  if (!isAuthenticated()) return false
  try {
    const res = await fetch('/auth/me', { headers: authHeaders() })
    if (res.ok) return true
    clearToken()
    return false
  } catch {
    clearToken()
    return false
  }
}
