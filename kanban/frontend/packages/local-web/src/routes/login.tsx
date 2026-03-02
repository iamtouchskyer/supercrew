import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { LightningIcon } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { useEffect } from 'react'
import { setToken } from '@vibe/app-core'
import DotGrid from '@web/components/DotGrid'
import BlurText from '@web/components/BlurText'
import LangToggle from '@web/components/LangToggle'

export const Route = createFileRoute('/login')({
  validateSearch: (s: Record<string, unknown>) => ({
    error: s.error as string | undefined,
    token: s.token as string | undefined,
  }),
  component: LoginPage,
})

function LoginPage() {
  const { error, token } = useSearch({ from: '/login' })
  const navigate = useNavigate()
  const { t } = useTranslation()

  // Handle OAuth callback token
  useEffect(() => {
    if (token) {
      setToken(token)
      navigate({ to: '/' })
    }
  }, [token])

  const errorMessage = error
    ? t(`login.errors.${error}`, t('login.errors.unknown'))
    : null

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#060010' }}>
      {/* DotGrid 全屏背景 */}
      <DotGrid
        className="dot-grid-bg"
        dotSize={6}
        gap={28}
        baseColor="#1e1e3a"
        activeColor="#6060c0"
        proximity={130}
      />

      {/* 居中卡片 */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}>
        <div style={{
          width: '100%',
          maxWidth: 360,
          borderRadius: 20,
          border: '1px solid rgba(255,255,255,0.10)',
          background: '#0e0e1c',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          padding: '40px 36px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 24,
        }}>
          {/* Language toggle aligned to right */}
          <div style={{ alignSelf: 'flex-end', marginBottom: -8, marginTop: -8 }}>
            <LangToggle />
          </div>

          {/* Logo */}
          <div style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: 'linear-gradient(135deg, var(--rb-accent) 0%, var(--rb-accent2) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 20px var(--rb-glow)',
          }}>
            <LightningIcon size={22} weight="fill" color="#000" />
          </div>

          {/* Title */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
              <BlurText
                text="Super Crew"
                delay={120}
                direction="top"
                stepDuration={0.3}
                animateBy="words"
              />
            </div>
            <p style={{
              marginTop: 8,
              color: 'rgba(255,255,255,0.5)',
              fontSize: 13.5,
              lineHeight: 1.55,
              textAlign: 'center',
            }}>
              {t('login.subtitle')}
            </p>
          </div>

          {/* Error */}
          {errorMessage && (
            <div style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 8,
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.25)',
              color: '#fca5a5',
              fontSize: 13,
              textAlign: 'center',
            }}>
              {errorMessage}
            </div>
          )}

          {/* GitHub Login */}
          <a
            href="/auth/github"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: '12px 20px',
              borderRadius: 10,
              background: '#fff',
              color: '#000',
              fontWeight: 600,
              fontSize: 14,
              textDecoration: 'none',
              justifyContent: 'center',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = '0.85')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = '1')}
          >
            <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            {t('login.githubLogin')}
          </a>
        </div>
      </div>
    </div>
  )
}
