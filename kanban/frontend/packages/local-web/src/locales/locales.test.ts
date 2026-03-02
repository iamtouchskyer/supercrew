import { describe, it, expect } from 'vitest'
import en from './en.json'
import zh from './zh.json'

function flatKeys(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [prefix]
  return Object.keys(obj as object).flatMap(k =>
    flatKeys((obj as Record<string, unknown>)[k], prefix ? `${prefix}.${k}` : k)
  )
}

describe('locale files', () => {
  it('zh has all keys that en has', () => {
    const enKeys = flatKeys(en)
    const zhKeys = new Set(flatKeys(zh))
    const missing = enKeys.filter(k => !zhKeys.has(k))
    expect(missing).toEqual([])
  })

  it('en has all keys that zh has', () => {
    const zhKeys = flatKeys(zh)
    const enKeys = new Set(flatKeys(en))
    const extra = zhKeys.filter(k => !enKeys.has(k))
    expect(extra).toEqual([])
  })

  it('en has no empty string values', () => {
    const emptyKeys = flatKeys(en).filter(k => {
      const parts = k.split('.')
      let node: unknown = en
      for (const p of parts) node = (node as Record<string, unknown>)[p]
      return node === ''
    })
    expect(emptyKeys).toEqual([])
  })

  it('zh has no empty string values', () => {
    const emptyKeys = flatKeys(zh).filter(k => {
      const parts = k.split('.')
      let node: unknown = zh
      for (const p of parts) node = (node as Record<string, unknown>)[p]
      return node === ''
    })
    expect(emptyKeys).toEqual([])
  })
})
