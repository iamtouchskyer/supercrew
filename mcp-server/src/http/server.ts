import type { Hono } from 'hono'

export function startHttpServer(app: Hono, port: number) {
  return Bun.serve({
    port,
    fetch: app.fetch,
  })
}
