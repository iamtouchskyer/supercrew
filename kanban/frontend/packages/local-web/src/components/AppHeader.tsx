import { useTranslation } from 'react-i18next'
import {
  LightningIcon, SunIcon, MoonIcon, LinkBreakIcon, SignOutIcon, GlobeIcon,
} from '@phosphor-icons/react'

interface AppHeaderProps {
  dark: boolean
  onToggleTheme: () => void
  onLogout: () => void
  onDisconnect: () => void
}

function HeaderBtn({
  icon, label, onClick, title,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  title?: string
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'transparent', border: 'none', cursor: 'pointer',
        padding: '6px 10px', borderRadius: 8,
        color: 'hsl(var(--text-low))',
        fontSize: 13, fontWeight: 500,
        fontFamily: 'Instrument Sans, sans-serif',
        transition: 'background 0.15s, color 0.15s',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement
        el.style.background = 'hsl(var(--_muted))'
        el.style.color = 'hsl(var(--text-high))'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement
        el.style.background = 'transparent'
        el.style.color = 'hsl(var(--text-low))'
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

export default function AppHeader({ dark, onToggleTheme, onLogout, onDisconnect }: AppHeaderProps) {
  const { t, i18n } = useTranslation()
  const isZh = i18n.language.startsWith('zh')

  return (
    <header style={{
      flexShrink: 0,
      height: 52,
      display: 'flex', alignItems: 'center',
      padding: '0 16px',
      borderBottom: '1px solid hsl(var(--_border))',
      background: 'hsl(var(--_bg-secondary-default))',
      backdropFilter: 'blur(12px)',
      zIndex: 20,
    }}>
      {/* ── Logo ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: 'linear-gradient(135deg, var(--rb-accent) 0%, var(--rb-accent2) 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px var(--rb-glow)',
          flexShrink: 0,
        }}>
          <LightningIcon size={14} weight="fill" color={dark ? '#000' : '#fff'} />
        </div>
        <span style={{
          fontSize: 15, fontWeight: 700,
          color: 'var(--rb-accent)',
          fontFamily: 'Instrument Sans, sans-serif',
          letterSpacing: '-0.01em',
        }}>
          Super Crew
        </span>
      </div>

      {/* ── Controls ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <HeaderBtn
          icon={<GlobeIcon size={15} weight="regular" />}
          label={isZh ? '中文' : 'English'}
          onClick={() => i18n.changeLanguage(isZh ? 'en' : 'zh')}
          title={isZh ? 'Switch to English' : '切换为中文'}
        />
        <HeaderBtn
          icon={dark
            ? <SunIcon size={15} weight="regular" />
            : <MoonIcon size={15} weight="regular" />
          }
          label={dark ? t('sidebar.lightMode') : t('sidebar.darkMode')}
          onClick={onToggleTheme}
        />
        <HeaderBtn
          icon={<LinkBreakIcon size={15} weight="regular" />}
          label={t('sidebar.disconnect')}
          onClick={onDisconnect}
        />
        <HeaderBtn
          icon={<SignOutIcon size={15} weight="regular" />}
          label={t('sidebar.logout')}
          onClick={onLogout}
        />
      </div>
    </header>
  )
}
