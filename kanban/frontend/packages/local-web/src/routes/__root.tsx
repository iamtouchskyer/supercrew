import { Outlet, createRootRoute, useRouterState, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  SquaresFourIcon, UsersIcon, BookOpenIcon,
  LightbulbIcon, LightningIcon,
} from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import AppHeader from '@web/components/AppHeader'
import Dock from '@web/components/Dock'
import { isAuthenticated, authHeaders, clearToken } from '@vibe/app-core'
import type { DockItemConfig } from '@web/components/Dock'

const PUBLIC_PATHS = ['/login', '/auth/callback', '/welcome']

function RootLayout() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [dark, setDark] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : true
  )

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('crew-theme', dark ? 'dark' : 'light')
  }, [dark])

  // Restore from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('crew-theme')
    if (saved) setDark(saved === 'dark')
  }, [])

  const pathname = useRouterState({ select: s => s.location.pathname })
  const navigate = useNavigate()

  // Route guard: redirect to /login if not authenticated on protected routes
  useEffect(() => {
    if (!PUBLIC_PATHS.includes(pathname) && !isAuthenticated()) {
      navigate({ to: '/login', search: { error: undefined, token: undefined } })
    }
  }, [pathname])

  // FRE detection: if authenticated but no projects, go to /welcome
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
    const frePaths = [...PUBLIC_PATHS]
    if (isAuthenticated() && Array.isArray(projects) && projects.length === 0 && !frePaths.includes(pathname)) {
      navigate({ to: '/welcome' })
    }
  }, [projects, pathname])

  function handleLogout() {
    clearToken()
    queryClient.clear()
    void navigate({ to: '/login', search: { error: undefined, token: undefined } })
  }

  async function handleDisconnect() {
    const ok = window.confirm(t('sidebar.disconnectConfirm'))
    if (!ok) return
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

  // Show full-page layout (no dock) for public routes
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
      label: 'Super Crew',
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
    }}>
      {/* ── Header ── */}
      <AppHeader
        dark={dark}
        onToggleTheme={() => setDark(d => !d)}
        onLogout={handleLogout}
        onDisconnect={() => void handleDisconnect()}
      />

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
