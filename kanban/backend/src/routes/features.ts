// Features route — serves .supercrew/features/ data as kanban-compatible tasks
// Only active when SUPERCREW_DEMO=true

import { Hono } from 'hono'
import { listSupercrewFeatures, isSupcrewDemoEnabled } from '../store/supercrew-store.js'

export function createFeaturesRouter() {
  const app = new Hono()

  // Guard: only respond when demo mode is enabled
  app.use('*', async (c, next) => {
    if (!isSupcrewDemoEnabled()) {
      return c.json({ error: 'Supercrew demo mode is not enabled. Set SUPERCREW_DEMO=true' }, 404)
    }
    await next()
  })

  app.get('/', (c) => {
    const features = listSupercrewFeatures()
    return c.json(features)
  })

  return app
}
