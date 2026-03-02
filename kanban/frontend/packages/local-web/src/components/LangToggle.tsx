import { useTranslation } from 'react-i18next'

export default function LangToggle({ style }: { style?: React.CSSProperties }) {
  const { i18n } = useTranslation()
  const isZh = i18n.language.startsWith('zh')

  return (
    <button
      onClick={() => i18n.changeLanguage(isZh ? 'en' : 'zh')}
      title={isZh ? 'Switch to English' : '切换为中文'}
      style={{
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        fontSize: 11,
        fontWeight: 600,
        color: 'hsl(var(--text-low))',
        letterSpacing: '0.02em',
        padding: '4px 6px',
        borderRadius: 4,
        transition: 'color 0.15s',
        fontFamily: 'Instrument Sans, sans-serif',
        ...style,
      }}
      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'hsl(var(--text-high))')}
      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'hsl(var(--text-low))')}
    >
      {isZh ? 'EN' : '中'}
    </button>
  )
}
