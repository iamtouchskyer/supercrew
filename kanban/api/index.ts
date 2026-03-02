export const config = { runtime: 'nodejs' }

// Dynamic import() is required because Vercel's @vercel/node compiler
// outputs CJS (require), but backend uses ESM ("type":"module").
// CJS require() cannot load ESM, but dynamic import() can.
export default async function handler(req: Request) {
  const { handle } = await import('hono/vercel')
  const { default: app } = await import('../backend/src/index.js')
  return handle(app)(req)
}
