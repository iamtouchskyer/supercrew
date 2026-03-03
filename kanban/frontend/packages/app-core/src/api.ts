import type { FeatureBoard, FeatureMeta, Feature, DesignDoc, PlanDoc } from './types.js'
import { authHeaders, clearToken } from './auth.js'

const BASE = '/api'

let redirecting = false

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    if (res.status === 401 && !redirecting) {
      redirecting = true
      clearToken()
      window.location.href = '/login'
    }
    throw new Error(`${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

/** Merge auth + extra headers */
function headers(extra?: Record<string, string>): Record<string, string> {
  return { ...authHeaders(), ...extra }
}

// ─── Board (aggregate) ───────────────────────────────────────────────────────

export const fetchBoard = (): Promise<FeatureBoard> =>
  fetch(`${BASE}/board`, { headers: headers() }).then(json<FeatureBoard>)

// ─── Features (read-only) ────────────────────────────────────────────────────

export const fetchFeatures = (): Promise<FeatureMeta[]> =>
  fetch(`${BASE}/features`, { headers: headers() }).then(json<FeatureMeta[]>)

export const fetchFeature = (id: string): Promise<Feature> =>
  fetch(`${BASE}/features/${id}`, { headers: headers() }).then(json<Feature>)

export const fetchFeatureDesign = (id: string): Promise<DesignDoc> =>
  fetch(`${BASE}/features/${id}/design`, { headers: headers() }).then(json<DesignDoc>)

export const fetchFeaturePlan = (id: string): Promise<PlanDoc> =>
  fetch(`${BASE}/features/${id}/plan`, { headers: headers() }).then(json<PlanDoc>)
