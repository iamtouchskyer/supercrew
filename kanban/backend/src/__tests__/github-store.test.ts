import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
global.fetch = mockFetch

import { listTasksGH, readTaskGH } from '../store/github-store.js'

const TOKEN = 'ghp_test'
const OWNER = 'testowner'
const REPO = 'testrepo'

describe('github-store', () => {
  beforeEach(() => { mockFetch.mockReset() })

  it('listTasksGH returns empty array when directory missing', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 } as any)
    const result = await listTasksGH(TOKEN, OWNER, REPO)
    expect(result).toEqual([])
  })

  it('listTasksGH skips template files', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { name: '_template.md', type: 'file' },
        { name: 'ENG-001.md', type: 'file' },
      ],
    } as any)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: btoa('---\ntitle: Test Task\nstatus: backlog\npriority: P2\ncreated: 2026-01-01\nupdated: 2026-01-01\ntags: []\nblocks: []\nblocked_by: []\n---\nTask body'),
        sha: 'abc123',
      }),
    } as any)

    const result = await listTasksGH(TOKEN, OWNER, REPO)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('ENG-001')
    expect(result[0].title).toBe('Test Task')
  })

  it('readTaskGH returns null when file missing', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 } as any)
    const result = await readTaskGH(TOKEN, OWNER, REPO, 'ENG-999')
    expect(result).toBeNull()
  })
})
