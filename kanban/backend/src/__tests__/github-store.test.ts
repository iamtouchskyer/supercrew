import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
global.fetch = mockFetch as any

import { listFeaturesGH, getFeatureMetaGH } from '../store/github-store.js'

const TOKEN = 'ghp_test'
const OWNER = 'testowner'
const REPO = 'testrepo'

describe('github-store', () => {
  beforeEach(() => { mockFetch.mockReset() })

  it('listFeaturesGH returns empty array when directory missing', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 } as any)
    const result = await listFeaturesGH(TOKEN, OWNER, REPO)
    expect(result).toEqual([])
  })

  it('listFeaturesGH lists feature directories and loads meta', async () => {
    // First call: list features directory
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { name: 'feat-001', type: 'dir' },
        { name: 'README.md', type: 'file' }, // should be skipped
      ],
    } as any)
    // Second call: ghGet for feat-001/meta.yaml
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: btoa('id: feat-001\ntitle: Test Feature\nstatus: planning\nowner: alice\npriority: P1\ncreated: "2026-01-01"\nupdated: "2026-01-01"\n'),
      }),
    } as any)

    const result = await listFeaturesGH(TOKEN, OWNER, REPO)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('feat-001')
    expect(result[0].title).toBe('Test Feature')
  })

  it('getFeatureMetaGH returns null when file missing', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 } as any)
    const result = await getFeatureMetaGH(TOKEN, OWNER, REPO, 'missing-feat')
    expect(result).toBeNull()
  })
})
