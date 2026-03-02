# Robustness P0+P1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add CI pipeline, startup validation, error boundaries, toast notifications, and route-level tests to make the kanban app production-robust.

**Architecture:** 6 independent tasks, each a single commit. P0 (Tasks 1-3) prevents "silently broken" states. P1 (Tasks 4-6) improves user-facing error experience and test coverage.

**Tech Stack:** GitHub Actions, vitest, React Error Boundary, Radix UI Toast, Hono

---

## P0 — Prevent Silent Failures

### Task 1: GitHub Actions CI Pipeline

**Files:**
- Create: `.github/workflows/ci.yml`

**Step 1: Create the workflow file**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - name: Install backend deps
        run: cd kanban/backend && bun install

      - name: Install frontend deps
        run: cd kanban/frontend && pnpm install

      - name: Typecheck backend (Bun)
        run: cd kanban/backend && npm run typecheck

      - name: Typecheck backend (Node)
        run: cd kanban/backend && npm run typecheck:node

      - name: Typecheck frontend
        run: cd kanban/frontend/packages/local-web && pnpm run check

      - name: Test backend
        run: cd kanban/backend && npm run test:vitest

      - name: Test app-core
        run: cd kanban/frontend/packages/app-core && pnpm run test

      - name: Bundle API (verify esbuild)
        run: cd kanban && npm run build:api
```

**Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions pipeline for typecheck + test + bundle"
```

---

### Task 2: Env Vars Startup Validation + .env.example

**Files:**
- Create: `kanban/backend/src/lib/env.ts`
- Create: `kanban/.env.example`
- Modify: `kanban/backend/src/routes/auth.ts` (lines 5-9) — replace raw process.env reads
- Modify: `kanban/backend/src/index.ts` (line 24) — import validated FRONTEND_URL

**Step 1: Create env validation module**

Create `kanban/backend/src/lib/env.ts`:

```typescript
// Required env vars — crash at startup if missing
function required(name: string): string {
  const val = process.env[name]
  if (!val) throw new Error(`Missing required env var: ${name}`)
  return val
}

// Optional env vars with defaults
function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback
}

// Validate on import — fails fast at startup
export const env = {
  GITHUB_CLIENT_ID: required('GITHUB_CLIENT_ID'),
  GITHUB_CLIENT_SECRET: required('GITHUB_CLIENT_SECRET'),
  JWT_SECRET: required('JWT_SECRET'),
  FRONTEND_URL: optional('FRONTEND_URL', 'http://localhost:5173'),
  BACKEND_URL: optional('BACKEND_URL', 'http://localhost:3001'),
  PORT: parseInt(optional('PORT', '3001'), 10),
  isVercel: !!process.env.VERCEL,
}
```

**Step 2: Create .env.example**

Create `kanban/.env.example`:

```bash
# Required — GitHub OAuth App credentials
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Required — secret for signing JWTs (generate with: openssl rand -hex 32)
JWT_SECRET=

# Optional — defaults shown
# FRONTEND_URL=http://localhost:5173
# BACKEND_URL=http://localhost:3001
# PORT=3001
```

**Step 3: Update auth.ts to use env module**

Replace lines 5-9 of `kanban/backend/src/routes/auth.ts`:

```typescript
// BEFORE:
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID!
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET!
const JWT_SECRET = process.env.JWT_SECRET!
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173'
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3001'

// AFTER:
import { env } from '../lib/env.js'

const GITHUB_CLIENT_ID = env.GITHUB_CLIENT_ID
const GITHUB_CLIENT_SECRET = env.GITHUB_CLIENT_SECRET
const JWT_SECRET = env.JWT_SECRET
const FRONTEND_URL = env.FRONTEND_URL
const BACKEND_URL = env.BACKEND_URL
```

NOTE: Keep the local const aliases so the rest of the file doesn't change.

**Step 4: Update index.ts to use env module**

In `kanban/backend/src/index.ts`, replace the env reads:

```typescript
// BEFORE:
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173'
const PORT = parseInt(process.env.PORT ?? '3001', 10)
// and the registry line using process.env.VERCEL

// AFTER:
import { env } from './lib/env.js'

const registry = env.isVercel
  ? new KVRegistry()
  : new FileRegistry(join(__dirname, '../../data/users.json'))

const FRONTEND_URL = env.FRONTEND_URL
const PORT = env.PORT
```

**Step 5: Update get-github-context.ts if it reads JWT_SECRET directly**

Check `kanban/backend/src/lib/get-github-context.ts` — if it reads `process.env.JWT_SECRET`, replace with `env.JWT_SECRET` import.

**Step 6: Run tests**

```bash
cd kanban/backend && npm run test:vitest
```

NOTE: Tests that mock env vars may need updating. If tests set `process.env.GITHUB_CLIENT_ID` etc., the env module will have already cached the values at import time. Tests should mock the `env` object directly or set env vars BEFORE importing.

**Step 7: Commit**

```bash
git add kanban/backend/src/lib/env.ts kanban/.env.example kanban/backend/src/routes/auth.ts kanban/backend/src/index.ts kanban/backend/src/lib/get-github-context.ts
git commit -m "feat: add env vars startup validation and .env.example"
```

---

### Task 3: Fix Existing Typecheck + Test Issues

**Files:**
- Already done in conversation: `tsconfig.json` (skipLibCheck), `github-store.test.ts` (fetch mock as any)
- Verify: `make typecheck` and `make test` both pass cleanly

**Step 1: Run full verification**

```bash
make typecheck && make test
```

**Step 2: Fix any remaining issues found**

**Step 3: Commit all typecheck/test fixes**

```bash
git commit -m "fix: resolve typecheck and test type errors"
```

---

## P1 — User-Facing Error Experience

### Task 4: React Error Boundary

**Files:**
- Create: `kanban/frontend/packages/local-web/src/components/ErrorBoundary.tsx`
- Modify: `kanban/frontend/packages/local-web/src/app/entry/Bootstrap.tsx` — wrap App with ErrorBoundary

**Step 1: Create ErrorBoundary component**

Create `kanban/frontend/packages/local-web/src/components/ErrorBoundary.tsx`:

```tsx
import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-100">
          <div className="max-w-md space-y-4 text-center">
            <h1 className="text-2xl font-bold">Something went wrong</h1>
            <p className="text-neutral-400">{this.state.error?.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="rounded bg-neutral-800 px-4 py-2 hover:bg-neutral-700"
            >
              Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
```

**Step 2: Wrap App in Bootstrap.tsx**

In Bootstrap.tsx, wrap the `<App />` (or `<RouterProvider>`) with `<ErrorBoundary>`:

```tsx
import { ErrorBoundary } from '../../components/ErrorBoundary'

// Inside render:
<React.StrictMode>
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </ErrorBoundary>
</React.StrictMode>
```

**Step 3: Commit**

```bash
git add kanban/frontend/packages/local-web/src/components/ErrorBoundary.tsx kanban/frontend/packages/local-web/src/app/entry/Bootstrap.tsx
git commit -m "feat: add React Error Boundary with fallback UI"
```

---

### Task 5: Toast Notification System for API Errors

**Files:**
- Create: `kanban/frontend/packages/local-web/src/components/Toaster.tsx`
- Create: `kanban/frontend/packages/local-web/src/lib/toast.ts`
- Modify: `kanban/frontend/packages/local-web/src/app/entry/Bootstrap.tsx` — add Toaster
- Modify: `kanban/frontend/packages/app-core/src/hooks/useMutations.ts` — add onError toast calls

NOTE: Use a minimal custom toast implementation (a few lines with Radix Toast or pure CSS + React state). Do NOT add a new dependency like react-hot-toast or sonner. Check if `@radix-ui/react-toast` is already installed; if yes, use it. If not, implement a minimal toast with a simple React context + portal.

**Step 1: Create toast store**

Create `kanban/frontend/packages/local-web/src/lib/toast.ts`:

```typescript
// Minimal toast store — no external deps
type Toast = { id: number; message: string; type: 'error' | 'success' }
type Listener = (toasts: Toast[]) => void

let toasts: Toast[] = []
let nextId = 0
const listeners = new Set<Listener>()

function emit() { listeners.forEach(fn => fn([...toasts])) }

export function toast(message: string, type: 'error' | 'success' = 'error') {
  const id = nextId++
  toasts = [...toasts, { id, message, type }]
  emit()
  setTimeout(() => dismiss(id), 4000)
}

export function dismiss(id: number) {
  toasts = toasts.filter(t => t.id !== id)
  emit()
}

export function subscribe(fn: Listener) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
```

**Step 2: Create Toaster component**

Create `kanban/frontend/packages/local-web/src/components/Toaster.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { subscribe, dismiss, type Toast } from '../lib/toast'

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([])
  useEffect(() => subscribe(setToasts), [])

  if (!toasts.length) return null
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map(t => (
        <div
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={`cursor-pointer rounded-lg px-4 py-3 text-sm shadow-lg ${
            t.type === 'error'
              ? 'bg-red-900/90 text-red-100'
              : 'bg-green-900/90 text-green-100'
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
```

**Step 3: Add Toaster to Bootstrap.tsx**

```tsx
import { Toaster } from '../../components/Toaster'

// Inside render, after App:
<ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <App />
    <Toaster />
  </QueryClientProvider>
</ErrorBoundary>
```

**Step 4: Wire toast into useMutations.ts onError callbacks**

In `kanban/frontend/packages/app-core/src/hooks/useMutations.ts`, the toast module lives in the local-web package, so we can't import it directly from app-core. Instead, configure React Query's global onError in Bootstrap.tsx:

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
    mutations: {
      onError: (error: Error) => {
        toast(error.message, 'error')
      },
    },
  },
})
```

This catches ALL mutation errors globally — no need to modify each useMutation individually.

**Step 5: Commit**

```bash
git add kanban/frontend/packages/local-web/src/lib/toast.ts kanban/frontend/packages/local-web/src/components/Toaster.tsx kanban/frontend/packages/local-web/src/app/entry/Bootstrap.tsx
git commit -m "feat: add toast notification system for API error feedback"
```

---

### Task 6: Backend Route-Level Tests

**Files:**
- Create: `kanban/backend/src/__tests__/routes-auth.test.ts`
- Create: `kanban/backend/src/__tests__/routes-tasks.test.ts`

Test the Hono app directly using `app.request()` (Hono's built-in test helper — no HTTP server needed).

**Step 1: Create auth route tests**

Create `kanban/backend/src/__tests__/routes-auth.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Must set env vars BEFORE importing app
process.env.GITHUB_CLIENT_ID = 'test-client-id'
process.env.GITHUB_CLIENT_SECRET = 'test-secret'
process.env.JWT_SECRET = 'test-jwt-secret'

const { app } = await import('../index.js')

describe('GET /auth/github', () => {
  it('redirects to GitHub login', async () => {
    const res = await app.request('/auth/github')
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toContain('github.com/login')
  })
})

describe('GET /auth/me', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await app.request('/auth/me')
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 401 with invalid token', async () => {
    const res = await app.request('/auth/me', {
      headers: { Authorization: 'Bearer invalid-token' },
    })
    expect(res.status).toBe(401)
  })
})

describe('GET /health', () => {
  it('returns ok', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })
})
```

**Step 2: Create tasks route tests**

Create `kanban/backend/src/__tests__/routes-tasks.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

process.env.GITHUB_CLIENT_ID = 'test-client-id'
process.env.GITHUB_CLIENT_SECRET = 'test-secret'
process.env.JWT_SECRET = 'test-jwt-secret'

const { app } = await import('../index.js')

describe('GET /api/tasks', () => {
  it('returns 401 without auth', async () => {
    const res = await app.request('/api/tasks')
    expect([401, 400]).toContain(res.status)
  })
})

describe('GET /api/board', () => {
  it('returns 401 without auth', async () => {
    const res = await app.request('/api/board')
    expect(res.status).toBe(401)
  })
})
```

**Step 3: Run all tests**

```bash
cd kanban/backend && npm run test:vitest
```

**Step 4: Commit**

```bash
git add kanban/backend/src/__tests__/routes-auth.test.ts kanban/backend/src/__tests__/routes-tasks.test.ts
git commit -m "test: add route-level tests for auth and tasks endpoints"
```

---

## Verification

After all 6 tasks, run full verification:

```bash
make typecheck && make test && make verify
```

All must pass.
