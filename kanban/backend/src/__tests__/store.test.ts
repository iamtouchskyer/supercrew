import { test, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { listFeatures, getFeatureMeta, getFeatureDesign, getFeaturePlan, getFeature, checkSupercrewExists } from '../store/index.js'

let tempDir: string

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'crew-test-'))
  process.env.SUPERCREW_DIR = tempDir
})

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true })
  delete process.env.SUPERCREW_DIR
})

// ─── listFeatures ────────────────────────────────────────────────────────────

test('listFeatures returns empty array when features dir missing', () => {
  expect(listFeatures()).toEqual([])
})

test('listFeatures reads feature directories', () => {
  const featDir = join(tempDir, 'features', 'feat-001')
  mkdirSync(featDir, { recursive: true })
  writeFileSync(
    join(featDir, 'meta.yaml'),
    'id: feat-001\ntitle: Test Feature\nstatus: planning\nowner: alice\npriority: P1\ncreated: "2026-01-01"\nupdated: "2026-01-01"\n',
  )
  const result = listFeatures()
  expect(result).toHaveLength(1)
  expect(result[0].id).toBe('feat-001')
  expect(result[0].title).toBe('Test Feature')
  expect(result[0].priority).toBe('P1')
})

// ─── getFeatureMeta ──────────────────────────────────────────────────────────

test('getFeatureMeta returns null for non-existent feature', () => {
  expect(getFeatureMeta('MISSING-001')).toBeNull()
})

test('getFeatureMeta parses meta.yaml correctly', () => {
  const featDir = join(tempDir, 'features', 'feat-002')
  mkdirSync(featDir, { recursive: true })
  writeFileSync(
    join(featDir, 'meta.yaml'),
    'id: feat-002\ntitle: Another Feature\nstatus: active\nowner: bob\npriority: P0\nteams:\n  - backend\ntags:\n  - infra\ncreated: "2026-01-01"\nupdated: "2026-01-02"\n',
  )
  const result = getFeatureMeta('feat-002')
  expect(result).not.toBeNull()
  expect(result!.title).toBe('Another Feature')
  expect(result!.status).toBe('active')
  expect(result!.priority).toBe('P0')
  expect(result!.teams).toEqual(['backend'])
  expect(result!.tags).toEqual(['infra'])
})

// ─── getFeatureDesign ────────────────────────────────────────────────────────

test('getFeatureDesign returns null when file missing', () => {
  expect(getFeatureDesign('MISSING-001')).toBeNull()
})

test('getFeatureDesign parses design.md correctly', () => {
  const featDir = join(tempDir, 'features', 'feat-003')
  mkdirSync(featDir, { recursive: true })
  writeFileSync(
    join(featDir, 'design.md'),
    '---\nstatus: in-review\nreviewers:\n  - carol\n---\nDesign body content.',
  )
  const result = getFeatureDesign('feat-003')
  expect(result).not.toBeNull()
  expect(result!.status).toBe('in-review')
  expect(result!.reviewers).toEqual(['carol'])
  expect(result!.body).toBe('Design body content.')
})

// ─── getFeaturePlan ──────────────────────────────────────────────────────────

test('getFeaturePlan returns null when file missing', () => {
  expect(getFeaturePlan('MISSING-001')).toBeNull()
})

test('getFeaturePlan parses plan.md correctly', () => {
  const featDir = join(tempDir, 'features', 'feat-004')
  mkdirSync(featDir, { recursive: true })
  writeFileSync(
    join(featDir, 'plan.md'),
    '---\ntotal_tasks: 5\ncompleted_tasks: 2\nprogress: 40\n---\nPlan body.',
  )
  const result = getFeaturePlan('feat-004')
  expect(result).not.toBeNull()
  expect(result!.total_tasks).toBe(5)
  expect(result!.completed_tasks).toBe(2)
  expect(result!.progress).toBe(40)
  expect(result!.body).toBe('Plan body.')
})

// ─── getFeature ──────────────────────────────────────────────────────────────

test('getFeature returns null for non-existent feature', () => {
  expect(getFeature('MISSING-001')).toBeNull()
})

test('getFeature returns full feature with all documents', () => {
  const featDir = join(tempDir, 'features', 'feat-005')
  mkdirSync(featDir, { recursive: true })
  writeFileSync(join(featDir, 'meta.yaml'), 'id: feat-005\ntitle: Full Feature\nstatus: designing\nowner: dave\npriority: P2\ncreated: "2026-01-01"\nupdated: "2026-01-01"\n')
  writeFileSync(join(featDir, 'design.md'), '---\nstatus: draft\nreviewers: []\n---\nDesign content.')
  writeFileSync(join(featDir, 'plan.md'), '---\ntotal_tasks: 3\ncompleted_tasks: 1\nprogress: 33\n---\nPlan content.')
  writeFileSync(join(featDir, 'log.md'), 'Log content here.')

  const result = getFeature('feat-005')
  expect(result).not.toBeNull()
  expect(result!.meta.title).toBe('Full Feature')
  expect(result!.design!.status).toBe('draft')
  expect(result!.plan!.total_tasks).toBe(3)
  expect(result!.log!.body).toBe('Log content here.')
})

// ─── checkSupercrewExists ────────────────────────────────────────────────────

test('checkSupercrewExists returns false when dir missing', () => {
  expect(checkSupercrewExists()).toBe(false)
})

test('checkSupercrewExists returns true when features dir exists', () => {
  mkdirSync(join(tempDir, 'features'), { recursive: true })
  expect(checkSupercrewExists()).toBe(true)
})
