import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowLeftIcon } from '@phosphor-icons/react'
import { fetchFeature, fetchFeatureDesign, fetchFeaturePlan } from '@app/api'
import type { Feature, SupercrewStatus, DesignStatus, DesignDoc, PlanDoc } from '@app/types'

export const Route = createFileRoute('/features/$id')({
  component: FeatureDetailPage,
})

/* ─── Status helpers ────────────────────────────────────────────────────────── */

const STATUS_COLOR: Record<SupercrewStatus, string> = {
  planning: '#a78bfa',
  designing: '#60a5fa',
  ready: '#34d399',
  active: '#fbbf24',
  blocked: '#f87171',
  done: '#6ee7b7',
}

const DESIGN_STATUS_COLOR: Record<DesignStatus, string> = {
  draft: '#9ca3af',
  'in-review': '#60a5fa',
  approved: '#34d399',
  rejected: '#f87171',
}

const PRIORITY_COLOR: Record<string, string> = {
  P0: '#ef4444',
  P1: '#f59e0b',
  P2: '#3b82f6',
  P3: '#9ca3af',
}

/* ─── Page ──────────────────────────────────────────────────────────────────── */

function FeatureDetailPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [tab, setTab] = useState<'overview' | 'design' | 'plan'>('overview')

  const { data: feature, isLoading, error } = useQuery<Feature>({
    queryKey: ['feature', id],
    queryFn: () => fetchFeature(id),
  })

  const { data: designDoc } = useQuery<DesignDoc>({
    queryKey: ['feature-design', id],
    queryFn: () => fetchFeatureDesign(id),
    enabled: tab === 'design',
  })

  const { data: planDoc } = useQuery<PlanDoc>({
    queryKey: ['feature-plan', id],
    queryFn: () => fetchFeaturePlan(id),
    enabled: tab === 'plan',
  })

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#94a3b8' }}>
        {t('common.loading', 'Loading…')}
      </div>
    )
  }

  if (error || !feature) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#f87171' }}>
        {t('common.error', 'Failed to load feature')}
      </div>
    )
  }

  const meta = feature.meta

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(30,41,59,0.6)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <button
          onClick={() => navigate({ to: '/' })}
          style={{
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            padding: 4,
          }}
        >
          <ArrowLeftIcon size={20} />
        </button>

        <Badge color={STATUS_COLOR[meta.status]}>{meta.status}</Badge>
        {meta.priority && (
          <Badge color={PRIORITY_COLOR[meta.priority] ?? '#9ca3af'}>{meta.priority}</Badge>
        )}

        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#e2e8f0', flex: 1 }}>
          {meta.title}
        </h1>
      </div>

      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(30,41,59,0.4)',
        }}
      >
        {(['overview', 'design', 'plan'] as const).map((t2) => (
          <button
            key={t2}
            onClick={() => setTab(t2)}
            style={{
              padding: '10px 20px',
              background: 'none',
              border: 'none',
              borderBottom: tab === t2 ? '2px solid #60a5fa' : '2px solid transparent',
              color: tab === t2 ? '#e2e8f0' : '#64748b',
              cursor: 'pointer',
              fontWeight: tab === t2 ? 600 : 400,
              fontSize: 14,
              textTransform: 'capitalize',
            }}
          >
            {t(`feature.tabs.${t2}`, t2)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
        {tab === 'overview' && <OverviewTab feature={feature} />}
        {tab === 'design' && <MarkdownBody md={designDoc?.body} />}
        {tab === 'plan' && <MarkdownBody md={planDoc?.body} />}
      </div>
    </div>
  )
}

/* ─── Overview Tab ──────────────────────────────────────────────────────────── */

function OverviewTab({ feature }: { feature: Feature }) {
  const { t } = useTranslation()
  const meta = feature.meta

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 720 }}>
      {/* Basic info */}
      <Section title={t('feature.overview.basic', 'Basic Info')}>
        <PropGrid>
          <PropCell label={t('feature.fields.status', 'Status')}>
            <Badge color={STATUS_COLOR[meta.status]}>{meta.status}</Badge>
          </PropCell>
          {meta.priority && (
            <PropCell label={t('feature.fields.priority', 'Priority')}>
              <Badge color={PRIORITY_COLOR[meta.priority] ?? '#9ca3af'}>{meta.priority}</Badge>
            </PropCell>
          )}
          {meta.owner && (
            <PropCell label={t('feature.fields.owner', 'Owner')}>{meta.owner}</PropCell>
          )}
          {meta.tags && meta.tags.length > 0 && (
            <PropCell label={t('feature.fields.tags', 'Tags')}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {meta.tags.map((tag) => (
                  <Badge key={tag} color="#475569">{tag}</Badge>
                ))}
              </div>
            </PropCell>
          )}
        </PropGrid>
      </Section>

      {/* Teams & Release */}
      {(meta.teams || meta.target_release || meta.blocked_by) && (
        <Section title={t('feature.overview.details', 'Details')}>
          <PropGrid>
            {meta.teams && meta.teams.length > 0 && (
              <PropCell label={t('feature.fields.teams', 'Teams')}>
                {meta.teams.join(', ')}
              </PropCell>
            )}
            {meta.target_release && (
              <PropCell label={t('feature.fields.targetRelease', 'Target Release')}>
                {meta.target_release}
              </PropCell>
            )}
            {meta.blocked_by && meta.blocked_by.length > 0 && (
              <PropCell label={t('feature.fields.blockedBy', 'Blocked By')}>
                {meta.blocked_by.join(', ')}
              </PropCell>
            )}
          </PropGrid>
        </Section>
      )}

      {/* Design summary */}
      {feature.design && (
        <Section title={t('feature.overview.design', 'Design')}>
          <PropGrid>
            <PropCell label={t('feature.fields.designStatus', 'Design Status')}>
              <Badge color={DESIGN_STATUS_COLOR[feature.design.status] ?? '#9ca3af'}>
                {feature.design.status}
              </Badge>
            </PropCell>
            {feature.design.reviewers && feature.design.reviewers.length > 0 && (
              <PropCell label={t('feature.fields.reviewers', 'Reviewers')}>
                {feature.design.reviewers.join(', ')}
              </PropCell>
            )}
          </PropGrid>
        </Section>
      )}

      {/* Plan summary */}
      {feature.plan && (
        <Section title={t('feature.overview.plan', 'Plan')}>
          <PropGrid>
            <PropCell label={t('feature.fields.totalTasks', 'Total Tasks')}>
              {feature.plan.total_tasks}
            </PropCell>
            <PropCell label={t('feature.fields.completedTasks', 'Completed')}>
              {feature.plan.completed_tasks}
            </PropCell>
            <PropCell label={t('feature.fields.progress', 'Progress')}>
              {Math.round(feature.plan.progress * 100)}%
            </PropCell>
          </PropGrid>
        </Section>
      )}

      {/* Log */}
      {feature.log && feature.log.body && (
        <Section title={t('feature.overview.log', 'Activity Log')}>
          <div
            style={{
              color: '#cbd5e1',
              lineHeight: 1.8,
              fontSize: 14,
              whiteSpace: 'pre-wrap',
            }}
          >
            {feature.log.body}
          </div>
        </Section>
      )}
    </div>
  )
}

/* ─── Shared components ─────────────────────────────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {title}
      </h3>
      {children}
    </div>
  )
}

function PropGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
      {children}
    </div>
  )
}

function PropCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 14, color: '#e2e8f0' }}>{children}</span>
    </div>
  )
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: 9999,
        fontSize: 12,
        fontWeight: 600,
        background: `${color}22`,
        color,
        border: `1px solid ${color}44`,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

function MarkdownBody({ md }: { md?: string }) {
  if (!md) {
    return <EmptyState />
  }
  return (
    <div
      style={{
        color: '#cbd5e1',
        lineHeight: 1.8,
        fontSize: 14,
        whiteSpace: 'pre-wrap',
        maxWidth: 720,
      }}
    >
      {md}
    </div>
  )
}

function EmptyState() {
  const { t } = useTranslation()
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200, color: '#475569' }}>
      {t('common.empty', 'No content yet')}
    </div>
  )
}
