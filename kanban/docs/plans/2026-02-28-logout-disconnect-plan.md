# Logout & Disconnect Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Logout button (clears JWT → `/login`) and a Disconnect button (unlinks current repo → `/welcome`) to the sidebar.

**Architecture:** Both actions live entirely in the frontend sidebar (`__root.tsx`). Logout is purely local (`clearToken()` + QueryClient flush + navigate). Disconnect calls the existing `DELETE /api/projects/:id` endpoint using `projects[0]` from the already-fetched projects list, then navigates to `/welcome`. New i18n keys are added to both locale files first (TDD: locale test must stay green).

**Tech Stack:** React + TanStack Router + TanStack Query (`useQueryClient`) + react-i18next + phosphor-icons + existing `clearToken()` from `@vibe/app-core`

---

## Working directory

All `src/` paths are relative to:
`crew/frontend/packages/local-web/src/`

API helper paths are relative to:
`crew/frontend/packages/app-core/src/`

---

### Task 1: Add i18n keys to locale files

**Files:**
- Modify: `crew/frontend/packages/local-web/src/locales/en.json`
- Modify: `crew/frontend/packages/local-web/src/locales/zh.json`

**Step 1: Add keys to en.json**

In `src/locales/en.json`, under `"sidebar"`, add three new keys:

```json
"sidebar": {
  "lightMode": "Light mode",
  "darkMode": "Dark mode",
  "logout": "Sign out",
  "disconnect": "Disconnect repo",
  "disconnectConfirm": "Disconnect from this repo? You can reconnect later."
},
```

**Step 2: Add keys to zh.json**

In `src/locales/zh.json`, under `"sidebar"`, add matching keys:

```json
"sidebar": {
  "lightMode": "亮色模式",
  "darkMode": "暗色模式",
  "logout": "退出登录",
  "disconnect": "断开 Repo",
  "disconnectConfirm": "断开当前 Repo？你随时可以重新连接。"
},
```

**Step 3: Run locale completeness test**

```bash
cd crew/frontend/packages/local-web
pnpm exec vitest run src/locales/locales.test.ts
```

Expected: **4 tests pass** (parity + empty value checks both directions)

**Step 4: Commit**

```bash
git add crew/frontend/packages/local-web/src/locales/en.json \
        crew/frontend/packages/local-web/src/locales/zh.json
git commit -m "feat(i18n): add logout/disconnect locale keys"
```

---

### Task 2: Add deleteProject API helper

**Files:**
- Modify: `crew/frontend/packages/app-core/src/api.ts`

**Step 1: Read the current api.ts**

Open `crew/frontend/packages/app-core/src/api.ts` and find the existing pattern. All helpers follow:
```ts
export const helperName = (...) =>
  fetch(`${BASE}/path`, { method: '...', headers: { ... } }).then(json<ReturnType>)
```

**Step 2: Add deleteProject after the existing helpers**

At the bottom of `api.ts`, add a new section:

```ts
// ─── Projects ─────────────────────────────────────────────────────────────────

export const deleteProject = (id: string, authHeader: Record<string, string>): Promise<{ ok: boolean }> =>
  fetch(`/api/projects/${id}`, {
    method: 'DELETE',
    headers: authHeader,
  }).then(json<{ ok: boolean }>)
```

Note: The auth header must be passed in because `api.ts` lives in `app-core` which doesn't have direct access to `localStorage` — or alternatively, import `authHeaders` from `./auth.js` in the same package. Check whether `authHeaders` is already exported from `auth.ts` in the same package — it is (line 26 of `auth.ts`). So instead:

```ts
// ─── Projects ─────────────────────────────────────────────────────────────────

export const deleteProject = (id: string): Promise<{ ok: boolean }> =>
  fetch(`/api/projects/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  }).then(json<{ ok: boolean }>)
```

The auth header will be added via the Vite proxy (which forwards cookies) — actually no. The backend requires a `Bearer` token. The simplest approach: call `fetch` directly in `__root.tsx` using `authHeaders()` inline, skipping a new api.ts helper entirely.

**Revised Step 2: Skip api.ts — call fetch inline in __root.tsx**

No changes needed to `api.ts`. The DELETE call will be written inline in `__root.tsx` using `authHeaders()` which is already imported there.

**Step 3: No commit needed** — Task 2 is a no-op (we skip the helper). Proceed to Task 3.

---

### Task 3: Add Logout and Disconnect buttons to sidebar

**Files:**
- Modify: `src/routes/__root.tsx`

**Step 1: Read the current __root.tsx**

Open `crew/frontend/packages/local-web/src/routes/__root.tsx` in full.

Existing imports include:
```ts
import { isAuthenticated, authHeaders } from '@vibe/app-core'
```

The file already has `useNavigate` and `useQuery` imports from TanStack.

**Step 2: Add new imports**

Add to the existing import lines:

```ts
import { useQueryClient } from '@tanstack/react-query'
import { SignOutIcon, LinkBreakIcon } from '@phosphor-icons/react'
import { clearToken } from '@vibe/app-core'
```

Note: `clearToken` may need to be exported from the `@vibe/app-core` package. Check `crew/frontend/packages/app-core/src/auth.ts` — `clearToken` is already defined there. Check `crew/frontend/packages/app-core/src/index.ts` (or `package.json` `exports`) to confirm it's exported. If not exported, add it to the barrel export.

**Step 3: Verify clearToken is exported from app-core**

Check `crew/frontend/packages/app-core/src/index.ts`:
- If it has `export { clearToken } from './auth.js'` → no action needed
- If not → add `clearToken` to the export

**Step 4: Add handler functions inside RootLayout()**

Inside `RootLayout()`, after the existing `const { t } = useTranslation()` line, add:

```tsx
const queryClient = useQueryClient()

function handleLogout() {
  clearToken()
  queryClient.clear()
  void navigate({ to: '/login' })
}

async function handleDisconnect() {
  const ok = window.confirm(t('sidebar.disconnectConfirm'))
  if (!ok) return
  // projects is already fetched via useQuery(['projects']) above in this component
  const projectId = Array.isArray(projects) && projects.length > 0 ? projects[0].id : null
  if (projectId) {
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
    } catch (e) {
      console.error('[disconnect] failed:', e)
    }
  }
  queryClient.clear()
  void navigate({ to: '/welcome' })
}
```

Note: `projects` is the variable from `const { data: projects } = useQuery(...)` already in the component. Make sure these functions are defined AFTER the `projects` variable declaration.

**Step 5: Add buttons to the sidebar**

In the sidebar bottom section (between `<div style={{ flex: 1 }} />` and `<LangToggle />`), add the two new buttons. Final order should be:

```tsx
<div style={{ flex: 1 }} />

{/* Lang toggle */}
<LangToggle />

{/* Disconnect */}
<button
  onClick={() => void handleDisconnect()}
  title={t('sidebar.disconnect')}
  className="rb-btn-icon"
  style={{ marginBottom: 2 }}
>
  <LinkBreakIcon size={15} weight="regular" />
</button>

{/* Theme toggle */}
<button
  onClick={() => setDark(d => !d)}
  title={dark ? t('sidebar.lightMode') : t('sidebar.darkMode')}
  className="rb-btn-icon"
  style={{ marginBottom: 4 }}
>
  {dark
    ? <SunIcon size={15} weight="regular" />
    : <MoonIcon size={15} weight="regular" />
  }
</button>

{/* Logout */}
<button
  onClick={handleLogout}
  title={t('sidebar.logout')}
  className="rb-btn-icon"
  style={{ marginBottom: 4 }}
>
  <SignOutIcon size={15} weight="regular" />
</button>
```

**Step 6: TypeScript check**

```bash
cd crew/frontend/packages/local-web
pnpm exec tsc --noEmit 2>&1 | grep "__root"
```

Expected: no new errors from `__root.tsx`. (Pre-existing errors in `providers/` are acceptable.)

**Step 7: Run locale test to confirm still green**

```bash
pnpm exec vitest run src/locales/locales.test.ts
```

Expected: 4 tests pass.

**Step 8: Commit**

```bash
git add crew/frontend/packages/local-web/src/routes/__root.tsx
# If app-core/index.ts was modified:
# git add crew/frontend/packages/app-core/src/index.ts
git commit -m "feat: add logout and disconnect repo buttons to sidebar"
```

---

## Summary

| Task | Files | Commit |
|------|-------|--------|
| 1 | en.json, zh.json | feat(i18n): add logout/disconnect locale keys |
| 2 | (skipped — no new helper needed) | — |
| 3 | __root.tsx (+ app-core/index.ts if needed) | feat: add logout and disconnect repo buttons to sidebar |

## Smoke Test

After implementation:

1. Load the app → sidebar shows `LinkBreakIcon` + `SignOutIcon` at the bottom
2. Click **Sign out** → JWT cleared, redirected to `/login`, board data gone
3. Log in again → board works normally
4. Click **Disconnect** → `window.confirm` appears → confirm → redirected to `/welcome`
5. Re-select repo → board works normally
6. Click **Disconnect** → confirm → cancel → nothing happens (stays on board)
