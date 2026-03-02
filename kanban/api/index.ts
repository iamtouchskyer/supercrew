export const config = { runtime: 'nodejs' }

// Use @hono/node-server's Vercel handler which properly converts
// Node.js IncomingMessage to Web Request (hono/vercel assumes Edge Runtime).
export default async function handler(req: any, res: any) {
  const { handle } = await import('@hono/node-server/vercel')
  const { app } = await import('../backend/src/index.js')
  return handle(app)(req, res)
}
