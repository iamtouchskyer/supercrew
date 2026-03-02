import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { setToken } from '@vibe/app-core'
import DotGrid from '@web/components/DotGrid'
import { useTranslation } from 'react-i18next'

export const Route = createFileRoute('/auth/callback')({
  component: AuthCallback,
})

function AuthCallback() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    const error = params.get('error')

    if (token) {
      setToken(token)
      navigate({ to: '/' })
    } else {
      navigate({ to: '/login', search: { error: error ?? 'unknown' } as any })
    }
  }, [])

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#060010' }}>
      <DotGrid
        className="dot-grid-bg"
        dotSize={6}
        gap={28}
        baseColor="#1e1e3a"
        activeColor="#6060c0"
        proximity={130}
      />
      <div style={{
        position: 'relative',
        zIndex: 1,
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, letterSpacing: '0.02em' }}>
          {t('callback.signingIn')}
        </p>
      </div>
    </div>
  )
}
