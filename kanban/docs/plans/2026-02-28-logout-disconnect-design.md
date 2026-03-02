# Logout & Disconnect Design

**Date:** 2026-02-28
**Status:** Approved

---

## Goal

Add two user-facing actions to the sidebar:

1. **Logout** — clear JWT, reset state, navigate to `/login`
2. **Disconnect** — unlink the current repo project, navigate to `/welcome` to re-select

---

## Definitions

| Action | Trigger | Effect |
|--------|---------|--------|
| Logout | `SignOutIcon` button (sidebar bottom) | `clearToken()` + QueryClient.clear() + navigate `/login` |
| Disconnect | `LinkBreakIcon` button (sidebar bottom) | `DELETE /api/projects/:id` + navigate `/welcome` |

---

## Architecture

### Logout (frontend-only)

JWT is stateless — no backend invalidation needed. Steps:

1. Call `clearToken()` (already in `app-core/auth.ts`)
2. Call `queryClient.clear()` to flush all cached data
3. Navigate to `/login`

No backend changes required.

### Disconnect (frontend + existing backend API)

Backend already has `DELETE /api/projects/:id` (in `routes/projects.ts`).

Frontend logic:
1. Read `projects` list already fetched in `__root.tsx` (`useQuery(['projects'])`)
2. Take `projects[0]` — for this local single-instance tool, there is typically one active project
3. Call `DELETE /api/projects/:projects[0].id` with auth headers
4. Navigate to `/welcome` on success (even on failure, to avoid being stuck)

No new backend endpoints required.

---

## UI

Sidebar bottom area (below flex spacer), order from top to bottom:

```
│  中/EN        ← LangToggle (existing)
│  🔌           ← Disconnect: LinkBreakIcon, title="Disconnect repo"
│  🌙           ← Theme toggle (existing)
│  →|           ← Logout: SignOutIcon, title="Sign out"
```

### Logout button
- Icon: `SignOutIcon` from `@phosphor-icons/react`
- Style: same `rb-btn-icon` class as theme toggle
- No confirm dialog — JWT is 30 days, user can re-login easily
- On click: execute logout synchronously

### Disconnect button
- Icon: `LinkBreakIcon` from `@phosphor-icons/react`
- Style: same `rb-btn-icon` class, color `hsl(var(--text-low))`
- `window.confirm()` dialog before executing (prevent accidental disconnect)
- Confirm message (i18n key `sidebar.disconnectConfirm`): "Disconnect from this repo? You can reconnect later."
- On success/failure: navigate to `/welcome`

---

## i18n Keys (additions to en.json / zh.json)

```json
// en.json additions under "sidebar":
"logout": "Sign out",
"disconnect": "Disconnect repo",
"disconnectConfirm": "Disconnect from this repo? You can reconnect later."

// zh.json additions:
"logout": "退出登录",
"disconnect": "断开 Repo",
"disconnectConfirm": "断开当前 Repo？你随时可以重新连接。"
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/routes/__root.tsx` | Add Logout + Disconnect buttons to sidebar; add `useQueryClient` |
| `src/locales/en.json` | Add `sidebar.logout`, `sidebar.disconnect`, `sidebar.disconnectConfirm` |
| `src/locales/zh.json` | Same keys in Chinese |
| `packages/app-core/src/api.ts` | Add `deleteProject(id)` helper |

---

## Error Handling

- Disconnect API failure: log error, still navigate to `/welcome` (don't leave user stuck)
- Logout: purely local, no failure cases

---

## Testing

- Run locale completeness test after adding keys: `pnpm exec vitest run src/locales/locales.test.ts`
- Manual smoke test: logout → redirects to /login; login again → board works. Disconnect → /welcome; re-select repo → board works.
