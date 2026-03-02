export const config = { runtime: 'nodejs' }

// Vercel Node.js runtime may pass a non-standard Request object
// whose headers is a plain object (no .get() method).
// Convert to a proper Web Request before handing to Hono.
function toWebRequest(req: any): Request {
  if (typeof req.headers?.get === 'function') return req

  const proto = req.headers?.['x-forwarded-proto'] ?? 'https'
  const host = req.headers?.['x-forwarded-host'] ?? req.headers?.host ?? 'localhost'
  const url = `${proto}://${host}${req.url ?? '/'}`

  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers ?? {})) {
    if (v != null) headers.set(k, Array.isArray(v) ? v.join(', ') : String(v))
  }

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
  return new Request(url, {
    method: req.method ?? 'GET',
    headers,
    body: hasBody ? req : undefined,
    ...(hasBody ? { duplex: 'half' } : {}),
  } as any)
}

export default async function handler(req: any) {
  const { app } = await import('../backend/src/index.js')
  return app.fetch(toWebRequest(req))
}
