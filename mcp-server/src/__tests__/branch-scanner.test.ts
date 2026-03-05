import { describe, it, expect } from 'vitest'
import { parseMetaYaml } from '../scanner/feature-parser.js'

describe('Feature Parser', () => {
  it('parses meta.yaml correctly', () => {
    const content = `
id: login-feature
title: User Login
status: active
owner: alice
priority: P1
teams:
  - frontend
  - backend
tags:
  - auth
`
    const result = parseMetaYaml(content, 'fallback-id')

    expect(result.id).toBe('login-feature')
    expect(result.title).toBe('User Login')
    expect(result.status).toBe('active')
    expect(result.owner).toBe('alice')
    expect(result.priority).toBe('P1')
    expect(result.teams).toEqual(['frontend', 'backend'])
    expect(result.tags).toEqual(['auth'])
  })

  it('uses fallback id when not in yaml', () => {
    const content = `
title: Some Feature
status: planning
`
    const result = parseMetaYaml(content, 'fallback-id')
    expect(result.id).toBe('fallback-id')
  })

  it('handles minimal yaml', () => {
    const content = `title: Minimal`
    const result = parseMetaYaml(content, 'test-id')

    expect(result.title).toBe('Minimal')
    expect(result.status).toBe('planning')
    expect(result.owner).toBeNull()
    expect(result.priority).toBeNull()
    expect(result.teams).toEqual([])
    expect(result.tags).toEqual([])
  })
})
