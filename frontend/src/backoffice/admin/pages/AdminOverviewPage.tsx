import { motion } from 'motion/react'
import { Link } from 'react-router'
import { useActiveAlerts } from '../../../api/alerts'
import { useDashboardStats, useDashboardSummary, useDashboardTrends, useStaffActivity } from '../../../api/dashboard'
import { messageFor } from '../../../api/errors'
import { useInterruptions } from '../../../api/interruptions'
import { IMPACT_LABEL, SEVERITY_LABEL, SEVERITY_TONE, STATUS_LABEL, STATUS_ORDER } from '../../lib/labels'
import { formatRelative } from '../../lib/format'
import { useDashboardView } from '../../lib/dashboardView'
import { useNow } from '../../lib/useNow'
import { AreaTrend } from '../../charts/AreaTrend'
import { BarChart } from '../../charts/BarChart'
import { DonutRing } from '../../charts/DonutRing'
import { Heatmap } from '../../charts/Heatmap'
import { DashboardViewToggle } from '../../shared/DashboardViewToggle'
import { SimpleDashboard } from '../../shared/SimpleDashboard'
import { StaffActivityFeed } from '../../shared/StaffActivityFeed'
import { LiveAuditFeed } from '../../shared/EntityHistory'
import { Tag } from '../../ui/Badges'
import { ButtonLink } from '../../ui/Button'
import { EmptyState, LiveDot, Skeleton } from '../../ui/Feedback'
import { PageHeader } from '../../ui/PageHeader'
import { Panel } from '../../ui/Panel'
import { StatTile } from '../../ui/StatTile'
import { stagger } from '../../ui/motion'
import layout from '../../ui/layout.module.css'
import styles from './admin.module.css'

const STATUS_COLOR: Record<string, string> = {
  SUBMITTED: 'var(--color-ember)',
  IN_REVIEW: 'var(--color-taken)',
  IN_PROGRESS: 'var(--color-progress)',
  WAITING_CITIZEN: 'var(--color-text-muted)',
  RESOLVED: 'var(--color-ok)',
  REJECTED: 'var(--color-alert)',
  CLOSED: 'var(--color-text-muted)',
}

const WEEKDAYS = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.']
const HEATMAP_HOURS = Array.from({ length: 12 }, (_, h) => `${String(h * 2).padStart(2, '0')}h`)
const dayLabel = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })

/** Change against the previous week, said in words: "+3 vs sem. préc.", "stable". */
function weekDelta(value: number, previous: number | null, lowerIsBetter = false, unit = '') {
  if (previous === null) return undefined
  const diff = Math.round((value - previous) * 10) / 10
  if (diff === 0) return { text: 'stable vs sem. préc.', good: true, direction: 'flat' as const }
  return {
    text: `${diff > 0 ? '+' : '−'}${Math.abs(diff)}${unit} vs sem. préc.`,
    good: lowerIsBetter ? diff < 0 : diff > 0,
    direction: diff > 0 ? ('up' as const) : ('down' as const),
  }
}

/** A sparkline only from real values, never a made-up curve. */
const series = (values: (number | null)[] | undefined) => {
  const real = values?.filter((v): v is number => v !== null)
  return real && real.length > 1 ? real : undefined
}

/** D19 / F47 / F50: global supervision of the platform. */
export default function AdminOverviewPage() {
  const now = useNow()
  const [view, setView] = useDashboardView()
  const statsQuery = useDashboardStats()
  const week = useDashboardSummary('7d').data?.indicators
  const trendsQuery = useDashboardTrends(14)
  const alerts = useActiveAlerts().data ?? []
  const interruptions = useInterruptions('current').data ?? []
  const activity = useStaffActivity(8)
  const stats = statsQuery.data
  const trends = trendsQuery.data
  const daily = trends?.daily

  const openByType = stats?.requests.open_by_type ?? {}
  const heatmap = trends?.heatmap
  const heatTotals = heatmap?.requests.map((row, d) => row.map((count, h) => count + heatmap.staff_actions[d][h]))
  const heatMax = Math.max(1, ...(heatTotals?.flat() ?? [0]))
  const median = week?.median_pickup_hours

  return (
    <motion.div className={layout.page} variants={stagger} initial="hidden" animate="show">
      <PageHeader
        title="Supervision globale"
        codes={['D19', 'F47', 'F50']}
        lead="L’état de Terra Nova en un écran : activité des habitants, charge des services, incidents et traçabilité."
        actions={
          <>
            <DashboardViewToggle value={view} onChange={setView} />
            <ButtonLink to="/admin/audit" icon="scroll" variant="ghost" data-print-hide>
              Journal d’audit
            </ButtonLink>
          </>
        }
      />

      {view === 'simple' ? (
        <SimpleDashboard
          base="/admin"
          indicators={['awaiting_pickup', 'overdue', 'requests_received', 'requests_resolved', 'median_pickup_hours', 'new_citizens']}
        />
      ) : (
        <>
          {statsQuery.isError && !stats && <EmptyState title={messageFor(statsQuery.error)} icon="alert" />}
          <motion.div className={layout.stats} variants={stagger}>
            <StatTile
              label="Citoyens inscrits"
              value={stats?.platform.citizens ?? null}
              icon="users"
              tone="ice"
              trend={series(daily?.map((d) => d.new_citizens))}
              delta={week && week.new_citizens.value > 0 ? { text: `+${week.new_citizens.value} sur 7 j`, good: true } : undefined}
            />
            <StatTile label="Demandes à traiter" value={stats?.requests.needs_action ?? null} icon="inbox" tone="ember" />
            <StatTile
              label="Résolues cette semaine"
              value={week?.requests_resolved.value ?? null}
              icon="check"
              tone="ok"
              trend={series(daily?.map((d) => d.resolved.total))}
              delta={week && weekDelta(week.requests_resolved.value, week.requests_resolved.previous)}
            />
            <StatTile
              label="Délai médian de prise en charge"
              value={median?.value === null || median === undefined ? null : Math.round(median.value)}
              unit="h"
              icon="clock"
              tone="progress"
              trend={series(daily?.map((d) => d.median_pickup_hours))}
              delta={median && median.value !== null ? weekDelta(Math.round(median.value), median.previous === null ? null : Math.round(median.previous), true, ' h') : undefined}
              hint={median && median.value === null ? 'aucune prise en charge sur 7 j' : undefined}
            />
          </motion.div>

          {(alerts.length > 0 || interruptions.length > 0) && (
            <Panel kicker="Situation en cours" title="Alertes et services perturbés" accent="alert">
              <ul className={styles.situation}>
                {alerts.map((a) => (
                  <li key={`a-${a.id}`}>
                    <Tag tone={SEVERITY_TONE[a.severity]} pulse={a.severity === 'CRITICAL'}>
                      {SEVERITY_LABEL[a.severity]}
                    </Tag>
                    <Link to="/admin/alertes">{a.title}</Link>
                    <small>
                      {a.audience === 'DISTRICTS' && a.districts.length > 0
                        ? `${a.districts.map((d) => d.name).join(', ')} · `
                        : a.audience === 'VULNERABLE'
                          ? 'Personnes vulnérables · '
                          : 'Tous les habitants · '}
                      {formatRelative(a.starts_at, now)}
                    </small>
                  </li>
                ))}
                {interruptions.map((i) => (
                  <li key={`i-${i.id}`}>
                    <Tag tone={i.impact === 'UNAVAILABLE' ? 'alert' : 'progress'}>{IMPACT_LABEL[i.impact]}</Tag>
                    <Link to="/admin/maintenance">{i.service.name}</Link>
                    <small>{i.ends_at ? `retour ${formatRelative(i.ends_at, now)}` : 'jusqu’à nouvel ordre'}</small>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <div className={[layout.grid, layout.split].join(' ')}>
            <Panel kicker="14 derniers jours" title="Demandes reçues et résolues">
              {daily ? (
                <AreaTrend
                  labels={daily.map((d) => dayLabel.format(new Date(`${d.date}T12:00:00`)))}
                  series={[
                    { key: 'received', label: 'Reçues', color: 'var(--series-1)', values: daily.map((d) => d.created.total), area: true },
                    { key: 'resolved', label: 'Résolues', color: 'var(--series-2)', values: daily.map((d) => d.resolved.total) },
                  ]}
                  summary="Demandes reçues et résolues par jour sur les 14 derniers jours"
                />
              ) : trendsQuery.isError ? (
                <EmptyState title={messageFor(trendsQuery.error)} icon="alert" />
              ) : (
                <Skeleton lines={6} />
              )}
            </Panel>
            <Panel kicker="Demandes ouvertes" title="Types de demandes">
              {stats ? (
                <DonutRing
                  centerLabel="ouvertes"
                  summary="Répartition des demandes ouvertes par type"
                  slices={[
                    { label: 'Messages', value: openByType.CONTACT ?? 0, color: 'var(--series-1)' },
                    { label: 'Démarches', value: openByType.PROCEDURE ?? 0, color: 'var(--series-2)' },
                    { label: 'Signalements', value: openByType.INCIDENT ?? 0, color: 'var(--series-3)' },
                  ]}
                />
              ) : (
                <Skeleton lines={5} />
              )}
            </Panel>
          </div>

          <div className={[layout.grid, layout.split].join(' ')}>
            <Panel kicker="Demandes reçues et actions des agents · 14 j" title="Activité par jour et par heure">
              {heatTotals ? (
                <Heatmap
                  rows={WEEKDAYS.map((day, d) => ({ day, values: heatTotals[d].map((count) => count / heatMax) }))}
                  columns={HEATMAP_HOURS}
                  summary="Intensité d’activité par jour de la semaine et tranche de deux heures, rapportée au créneau le plus actif"
                />
              ) : (
                <Skeleton lines={6} />
              )}
            </Panel>
            <Panel kicker="État des demandes" title="Par statut">
              {stats ? (
                <BarChart
                  summary="Nombre de demandes par statut"
                  valueHeader="Demandes"
                  bars={STATUS_ORDER.map((s) => ({ label: STATUS_LABEL[s], value: stats.requests.by_status[s] ?? 0, color: STATUS_COLOR[s] }))}
                />
              ) : (
                <Skeleton lines={5} />
              )}
            </Panel>
          </div>

          <div className={[layout.grid, layout.split].join(' ')}>
            <Panel
              kicker="F22 · Traitement des demandes"
              title="Activité du personnel en direct"
              actions={
                <>
                  <LiveDot />
                  <ButtonLink to="/admin/demandes" size="sm" variant="ghost">
                    Supervision
                  </ButtonLink>
                </>
              }
            >
              {activity.data ? (
                <StaffActivityFeed events={activity.data} base="/admin" />
              ) : activity.isError ? (
                <EmptyState title={messageFor(activity.error)} icon="alert" />
              ) : (
                <Skeleton lines={6} />
              )}
            </Panel>
            <Panel
              kicker="F47 · Traçabilité"
              title="Journal d’audit"
              actions={
                <>
                  <LiveDot />
                  <ButtonLink to="/admin/audit" size="sm" variant="ghost">
                    Tout voir
                  </ButtonLink>
                </>
              }
            >
              <LiveAuditFeed showIp />
            </Panel>
          </div>
        </>
      )}
    </motion.div>
  )
}
