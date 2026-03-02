# Bottom Dock Navigation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the left vertical sidebar with a ReactBits magnifying Dock at the bottom, and move theme/language toggles to the top-right corner.

**Architecture:** Create a typed `Dock.tsx` component (adapted from ReactBits source to TypeScript + CSS vars), then rewrite `__root.tsx` layout from `flex-row` to `flex-col` with the Dock pinned at the bottom.

**Tech Stack:** framer-motion (already installed), Phosphor icons (already installed), CSS custom properties for theming.

---

### Task 1: Create Dock.css

**Files:**
- Create: `crew/frontend/packages/local-web/src/components/Dock.css`

**Step 1: Create the file**

```css
.dock-outer {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  width: 100%;
  position: relative;
  overflow: visible;
  pointer-events: none;
}

.dock-panel {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: flex-end;
  width: fit-content;
  gap: 10px;
  border-radius: 14px;
  background: hsl(var(--_bg-secondary-default));
  border: 1px solid hsl(var(--_border));
  padding: 0 10px 8px;
  pointer-events: all;
  backdrop-filter: blur(12px);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
}

.dock-item {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: hsl(var(--_bg-primary-default));
  border: 1px solid hsl(var(--_border));
  cursor: pointer;
  outline: none;
  transition: border-color 0.15s;
}

.dock-item:hover,
.dock-item:focus-visible {
  border-color: hsl(var(--_border));
}

.dock-item-active {
  background: var(--rb-accent-dim);
  border-color: var(--rb-glow) !important;
  box-shadow: 0 0 10px var(--rb-glow);
}

.dock-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.dock-label {
  position: absolute;
  top: -28px;
  left: 50%;
  width: fit-content;
  white-space: pre;
  border-radius: 6px;
  border: 1px solid hsl(var(--_border));
  background: hsl(var(--_bg-secondary-default));
  padding: 2px 8px;
  font-size: 11px;
  color: hsl(var(--text-high));
  transform: translateX(-50%);
  font-family: 'Instrument Sans', sans-serif;
  pointer-events: none;
  z-index: 100;
}
```

**Step 2: Verify file exists**
```bash
ls crew/frontend/packages/local-web/src/components/Dock.css
```

---

### Task 2: Create Dock.tsx

**Files:**
- Create: `crew/frontend/packages/local-web/src/components/Dock.tsx`

**Step 1: Create the file**

```tsx
import {
  motion, useMotionValue, useSpring, useTransform, AnimatePresence,
} from 'framer-motion'
import { Children, cloneElement, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import type { MotionValue } from 'framer-motion'
import './Dock.css'

// ─── Internal sub-components ─────────────────────────────────────────────────

interface DockItemInternalProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  mouseX: MotionValue<number>
  spring: SpringConfig
  distance: number
  magnification: number
  baseItemSize: number
}

type SpringConfig = { mass: number; stiffness: number; damping: number }

function DockItem({
  children, className = '', onClick,
  mouseX, spring, distance, magnification, baseItemSize,
}: DockItemInternalProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isHovered = useMotionValue(0)

  const mouseDistance = useTransform(mouseX, (val: number) => {
    const rect = ref.current?.getBoundingClientRect() ?? { x: 0, width: baseItemSize }
    return val - rect.x - baseItemSize / 2
  })

  const targetSize = useTransform(
    mouseDistance,
    [-distance, 0, distance],
    [baseItemSize, magnification, baseItemSize],
  )
  const size = useSpring(targetSize, spring)

  return (
    <motion.div
      ref={ref}
      style={{ width: size, height: size }}
      onHoverStart={() => isHovered.set(1)}
      onHoverEnd={() => isHovered.set(0)}
      onFocus={() => isHovered.set(1)}
      onBlur={() => isHovered.set(0)}
      onClick={onClick}
      className={`dock-item ${className}`}
      tabIndex={0}
      role="button"
    >
      {Children.map(children, child =>
        cloneElement(child as ReactElement<{ isHovered?: MotionValue<number> }>, { isHovered }),
      )}
    </motion.div>
  )
}

function DockLabel({
  children, className = '', isHovered,
}: {
  children: ReactNode
  className?: string
  isHovered?: MotionValue<number>
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!isHovered) return
    return isHovered.on('change', v => setVisible(v === 1))
  }, [isHovered])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 0 }}
          animate={{ opacity: 1, y: -6 }}
          exit={{ opacity: 0, y: 0 }}
          transition={{ duration: 0.15 }}
          className={`dock-label ${className}`}
          role="tooltip"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function DockIcon({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`dock-icon ${className}`}>{children}</div>
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface DockItemConfig {
  icon: ReactNode
  label: string
  onClick?: () => void
  className?: string
}

export interface DockProps {
  items: DockItemConfig[]
  className?: string
  spring?: SpringConfig
  magnification?: number
  distance?: number
  panelHeight?: number
  dockHeight?: number
  baseItemSize?: number
}

export default function Dock({
  items,
  className = '',
  spring = { mass: 0.1, stiffness: 150, damping: 12 },
  magnification = 64,
  distance = 120,
  panelHeight = 58,
  dockHeight = 200,
  baseItemSize = 40,
}: DockProps) {
  const mouseX = useMotionValue(Infinity)
  const isHovered = useMotionValue(0)

  const maxHeight = useMemo(
    () => Math.max(dockHeight, magnification + magnification / 2 + 4),
    [dockHeight, magnification],
  )
  const heightRow = useTransform(isHovered, [0, 1], [panelHeight, maxHeight])
  const height = useSpring(heightRow, spring)

  return (
    <motion.div style={{ height }} className={`dock-outer ${className}`}>
      <motion.div
        onMouseMove={({ pageX }) => { isHovered.set(1); mouseX.set(pageX) }}
        onMouseLeave={() => { isHovered.set(0); mouseX.set(Infinity) }}
        className="dock-panel"
        style={{ height: panelHeight }}
        role="toolbar"
        aria-label="Navigation dock"
      >
        {items.map((item, i) => (
          <DockItem
            key={i}
            onClick={item.onClick}
            className={item.className ?? ''}
            mouseX={mouseX}
            spring={spring}
            distance={distance}
            magnification={magnification}
            baseItemSize={baseItemSize}
          >
            <DockIcon>{item.icon}</DockIcon>
            <DockLabel>{item.label}</DockLabel>
          </DockItem>
        ))}
      </motion.div>
    </motion.div>
  )
}
```

**Step 2: Run tsc check**
```bash
cd crew/frontend/packages/local-web && pnpm check 2>&1
```
Expected: zero errors related to Dock.tsx.

---

### Task 3: Update `__root.tsx`

**Files:**
- Modify: `crew/frontend/packages/local-web/src/routes/__root.tsx`

**Step 1: Replace the entire file with this content**

```tsx
import { Outlet, createRootRoute, useRouterState, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  SquaresFourIcon, UsersIcon, BookOpenIcon,
  LightbulbIcon, LightningIcon, SunIcon, MoonIcon,
} from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import LangToggle from '@web/components/LangToggle'
import Dock from '@web/components/Dock'
import { isAuthenticated, authHeaders } from '@vibe/app-core'
import type { DockItemConfig } from '@web/components/Dock'

const PUBLIC_PATHS = ['/login', '/auth/callback', '/welcome']

function RootLayout() {
  const { t } = useTranslation()
  const [dark, setDark] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : true,
  )

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('crew-theme', dark ? 'dark' : 'light')
  }, [dark])

  useEffect(() => {
    const saved = localStorage.getItem('crew-theme')
    if (saved) setDark(saved === 'dark')
  }, [])

  const pathname = useRouterState({ select: s => s.location.pathname })
  const navigate = useNavigate()

  // Route guard
  useEffect(() => {
    if (!PUBLIC_PATHS.includes(pathname) && !isAuthenticated()) {
      navigate({ to: '/login' })
    }
  }, [pathname])

  // FRE detection
  const { data: projects } = useQuery<any[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await fetch('/api/projects', { headers: authHeaders() })
      if (!res.ok) return []
      return res.json()
    },
    enabled: isAuthenticated() && !PUBLIC_PATHS.includes(pathname),
  })

  useEffect(() => {
    if (
      isAuthenticated() &&
      Array.isArray(projects) &&
      projects.length === 0 &&
      !PUBLIC_PATHS.includes(pathname)
    ) {
      navigate({ to: '/welcome' })
    }
  }, [projects, pathname])

  // Full-page layout for public routes (no dock)
  if (PUBLIC_PATHS.includes(pathname)) {
    return <Outlet />
  }

  const isActive = (to: string, exact = false) =>
    exact ? pathname === to : pathname.startsWith(to)

  const iconColor = (to: string, exact = false) =>
    isActive(to, exact) ? 'var(--rb-accent)' : 'hsl(var(--text-low))'

  const iconWeight = (to: string, exact = false): 'fill' | 'regular' =>
    isActive(to, exact) ? 'fill' : 'regular'

  const dockItems: DockItemConfig[] = [
    {
      icon: <LightningIcon size={17} weight="fill" color="var(--rb-accent)" />,
      label: 'Crew',
      className: '',
    },
    {
      icon: <SquaresFourIcon size={17} weight={iconWeight('/', true)} color={iconColor('/', true)} />,
      label: t('nav.board'),
      onClick: () => navigate({ to: '/' }),
      className: isActive('/', true) ? 'dock-item-active' : '',
    },
    {
      icon: <UsersIcon size={17} weight={iconWeight('/people')} color={iconColor('/people')} />,
      label: t('nav.people'),
      onClick: () => navigate({ to: '/people' }),
      className: isActive('/people') ? 'dock-item-active' : '',
    },
    {
      icon: <BookOpenIcon size={17} weight={iconWeight('/knowledge')} color={iconColor('/knowledge')} />,
      label: t('nav.knowledge'),
      onClick: () => navigate({ to: '/knowledge' }),
      className: isActive('/knowledge') ? 'dock-item-active' : '',
    },
    {
      icon: <LightbulbIcon size={17} weight={iconWeight('/decisions')} color={iconColor('/decisions')} />,
      label: t('nav.decisions'),
      onClick: () => navigate({ to: '/decisions' }),
      className: isActive('/decisions') ? 'dock-item-active' : '',
    },
  ]

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100vh', overflow: 'hidden',
      background: 'hsl(var(--_background))',
      position: 'relative',
    }}>
      {/* ── Top-right controls ── */}
      <div style={{
        position: 'absolute', top: 12, right: 16,
        display: 'flex', alignItems: 'center', gap: 4,
        zIndex: 20,
      }}>
        <LangToggle />
        <button
          onClick={() => setDark(d => !d)}
          title={dark ? t('sidebar.lightMode') : t('sidebar.darkMode')}
          className="rb-btn-icon"
        >
          {dark
            ? <SunIcon size={15} weight="regular" />
            : <MoonIcon size={15} weight="regular" />
          }
        </button>
      </div>

      {/* ── Main content ── */}
      <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <Outlet />
      </main>

      {/* ── Bottom Dock ── */}
      <div style={{
        flexShrink: 0,
        height: 74,
        position: 'relative',
        zIndex: 10,
        overflow: 'visible',
      }}>
        <Dock
          items={dockItems}
          baseItemSize={40}
          magnification={62}
          panelHeight={58}
          dockHeight={196}
          distance={110}
        />
      </div>
    </div>
  )
}

export const Route = createRootRoute({ component: RootLayout })
```

**Step 2: Run tsc check**
```bash
cd crew/frontend/packages/local-web && pnpm check 2>&1
```
Expected: zero errors.

**Step 3: Verify dev server starts**
```bash
cd crew/frontend/packages/local-web && pnpm dev 2>&1 &
# Open http://localhost:3000 and confirm:
# - Bottom dock visible with 5 items
# - Hover magnification works
# - Clicking nav items navigates correctly
# - Active item highlighted in accent color
# - Top-right shows Lang + theme toggle
# - Left sidebar is gone
```

---

### Task 4: Commit

**Step 1: Commit**

```bash
git add crew/frontend/packages/local-web/src/components/Dock.tsx \
        crew/frontend/packages/local-web/src/components/Dock.css \
        crew/frontend/packages/local-web/src/routes/__root.tsx
git commit -m "feat: replace sidebar with bottom ReactBits Dock, move controls to top-right"
```
