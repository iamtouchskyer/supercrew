# Repo Selection Combobox Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the always-visible search+card-list in `StepSelectRepo` with a Radix Popover combobox: click trigger → floating dropdown with search + repo list → select → close.

**Architecture:** Single-component change inside `welcome.tsx`. Radix `<Popover>` handles portal/outside-click/Escape. The trigger shows selected repo name or placeholder. The popover content contains a search `<input>` (auto-focused) and a scrollable `<button>` list. `SpotlightCard` is no longer used and its import is removed.

**Tech Stack:** React + `@radix-ui/react-popover` (already in deps) + `@phosphor-icons/react` + react-i18next + existing `useQuery(['github-repos'])`

---

## Working directory

All `src/` paths are relative to:
`crew/frontend/packages/local-web/src/`

Locale files are at:
`crew/frontend/packages/local-web/src/locales/`

---

### Task 1: Add i18n key for trigger placeholder

**Files:**
- Modify: `crew/frontend/packages/local-web/src/locales/en.json`
- Modify: `crew/frontend/packages/local-web/src/locales/zh.json`

**Step 1: Add key to en.json**

In `src/locales/en.json`, under `"welcome" → "step2"`, add:

```json
"step2": {
  "title": "Select GitHub Repo",
  "description": "Choose the repo you want to manage with Crew",
  "selectPlaceholder": "Select a repo…",
  "searchPlaceholder": "Search repos…",
  "loading": "Loading…",
  "noResults": "No repos found",
  "private": "private"
},
```

**Step 2: Add key to zh.json**

In `src/locales/zh.json`, under `"welcome" → "step2"`, add:

```json
"step2": {
  "title": "选择 GitHub Repo",
  "description": "选择你想通过 Crew 管理的项目仓库",
  "selectPlaceholder": "选择 Repo…",
  "searchPlaceholder": "搜索 repo…",
  "loading": "加载中…",
  "noResults": "没有找到匹配的 repo",
  "private": "私有"
},
```

**Step 3: Run locale test**

```bash
cd crew/frontend/packages/local-web
pnpm exec vitest run src/locales/locales.test.ts
```

Expected: **4 tests pass**

**Step 4: Commit**

```bash
git add crew/frontend/packages/local-web/src/locales/en.json \
        crew/frontend/packages/local-web/src/locales/zh.json
git commit -m "feat(i18n): add selectPlaceholder key for repo combobox"
```

---

### Task 2: Rewrite StepSelectRepo as a Popover combobox

**Files:**
- Modify: `src/routes/welcome.tsx`

**Step 1: Read the current welcome.tsx**

Open `crew/frontend/packages/local-web/src/routes/welcome.tsx` in full to understand the existing imports and `StepSelectRepo` component.

**Step 2: Update imports**

Replace the existing import block at the top of `welcome.tsx`:

Current imports to change:
```ts
import { LightningIcon, MagnifyingGlassIcon, CheckCircleIcon, WarningCircleIcon } from '@phosphor-icons/react'
import SpotlightCard from '@web/components/SpotlightCard'
```

New imports (remove `SpotlightCard`, add `ChevronDownIcon` and Popover):
```ts
import { LightningIcon, MagnifyingGlassIcon, CheckCircleIcon, WarningCircleIcon, ChevronDownIcon } from '@phosphor-icons/react'
import { Popover, PopoverTrigger, PopoverContent } from '@radix-ui/react-popover'
```

**Step 3: Add `open` state to StepSelectRepo**

Inside `function StepSelectRepo(...)`, after `const [search, setSearch] = useState('')`, add:

```ts
const [open, setOpen] = useState(false)
```

**Step 4: Replace the JSX in StepSelectRepo**

Replace the entire `return (...)` block of `StepSelectRepo` with:

```tsx
return (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 4 }}>
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: '#fff', margin: '0 0 4px' }}>
        {t('welcome.step2.title')}
      </h3>
      <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
        {t('welcome.step2.description')}
      </p>
    </div>

    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch('') }}>
      {/* Trigger */}
      <PopoverTrigger asChild>
        <button
          style={{
            width: '100%',
            padding: '9px 12px',
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${open ? 'var(--rb-accent)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 8,
            color: selected ? '#fff' : 'rgba(255,255,255,0.35)',
            fontSize: 13,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxSizing: 'border-box',
            transition: 'border-color 0.15s',
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selected ? selected.full_name : t('welcome.step2.selectPlaceholder')}
          </span>
          <ChevronDownIcon
            size={14}
            style={{
              flexShrink: 0,
              marginLeft: 8,
              transition: 'transform 0.15s',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              color: 'rgba(255,255,255,0.5)',
            }}
          />
        </button>
      </PopoverTrigger>

      {/* Dropdown panel */}
      <PopoverContent
        sideOffset={4}
        onOpenAutoFocus={e => e.preventDefault()}
        style={{
          width: 'var(--radix-popover-trigger-width)',
          background: '#13132a',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 10,
          padding: 8,
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          zIndex: 50,
          outline: 'none',
        }}
      >
        {/* Search input */}
        <div style={{ position: 'relative', marginBottom: 6 }}>
          <MagnifyingGlassIcon
            size={13}
            style={{
              position: 'absolute', left: 9, top: '50%',
              transform: 'translateY(-50%)',
              color: 'rgba(255,255,255,0.4)',
            }}
          />
          <input
            autoFocus
            type="text"
            placeholder={t('welcome.step2.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '7px 8px 7px 28px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 6,
              color: '#fff',
              fontSize: 12.5,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Repo list */}
        <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {isLoading ? (
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
              {t('welcome.step2.loading')}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
              {t('welcome.step2.noResults')}
            </div>
          ) : filtered.map(repo => {
            const isSelected = selected?.id === repo.id
            return (
              <button
                key={repo.id}
                onClick={() => { onSelect(repo); setOpen(false); setSearch('') }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 10px',
                  borderRadius: 6,
                  background: isSelected ? 'rgba(52,211,153,0.12)' : 'transparent',
                  border: `1px solid ${isSelected ? 'var(--rb-accent)' : 'transparent'}`,
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 13,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ fontWeight: 500 }}>
                  {repo.full_name}
                  {repo.private && (
                    <span style={{
                      marginLeft: 6, fontSize: 10.5,
                      color: 'rgba(255,255,255,0.45)',
                      background: 'rgba(255,255,255,0.07)',
                      padding: '1px 6px', borderRadius: 4,
                    }}>
                      {t('welcome.step2.private')}
                    </span>
                  )}
                </div>
                {repo.description && (
                  <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
                    {repo.description}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  </div>
)
```

**Step 5: TypeScript check**

```bash
cd crew/frontend/packages/local-web
pnpm exec tsc --noEmit 2>&1 | grep "welcome"
```

Expected: no errors from `welcome.tsx`.

**Step 6: Run locale test**

```bash
pnpm exec vitest run src/locales/locales.test.ts
```

Expected: 4 tests pass.

**Step 7: Commit**

```bash
git add crew/frontend/packages/local-web/src/routes/welcome.tsx
git commit -m "feat: replace repo list with Radix Popover combobox"
```

---

## Smoke Test

After implementation, open the app and go to `/welcome` (step 2):

1. The search box + card list is **gone**; a single trigger button appears showing "Select a repo…"
2. Click the trigger → dropdown opens with search input (auto-focused) + repo list below
3. Type to filter → list narrows in real time
4. Click a repo → dropdown closes, trigger shows `repo.full_name` in white
5. Click Next → proceeds to step 3
6. Click trigger again → previously selected repo is highlighted in green
7. Press Escape → dropdown closes without changing selection
8. Click outside the dropdown → closes without changing selection
