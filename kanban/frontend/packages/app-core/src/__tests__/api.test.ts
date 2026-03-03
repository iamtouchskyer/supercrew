import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchBoard } from '../api.js'

describe('API error handling', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('throws with status message on non-ok response', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response('Not Found', { status: 404, statusText: 'Not Found' }),
    )
    await expect(fetchBoard()).rejects.toThrow('404 Not Found')
  })

  it('returns parsed JSON on 200', async () => {
    const board = { features: [], columns: {} }
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify(board), { status: 200 }),
    )
    const result = await fetchBoard()
    expect(result).toEqual(board)
  })
})
