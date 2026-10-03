import { motion } from 'motion/react'
import { Link } from 'react-router'
import { IMPACT_LABEL, NEEDS_ACTION, SEVERITY_LABEL, SEVERITY_TONE, STATUS_LABEL, STATUS_ORDER } from '../../lib/labels'
import { formatRelative } from '../../lib/format'
import { useServiceName } from '../../lib/lookups'
import { useNow } from '../../lib/useNow'
import { ACTIVITY_HEATMAP, HEATMAP_HOURS, REQUEST_TREND, SPARKS } from '../../mocks/stats'
import { AreaTrend } from '../../charts/AreaTrend'
import { BarChart } from '../../charts/BarChart'
import { DonutRing } from '../../charts/DonutRing'
import { Heatmap } from '../../charts/Heatmap'
import { LiveAuditFeed } from '../../shared/EntityHistory'
import { useCatalogStore } from '../../stores/catalogStore'
import { useContentStore } from '../../stores/contentStore'
import { useRequestStore } from '../../stores/requestStore'
import { useUserStore } from '../../stores/userStore'
import { Tag } from '../../ui/Badges'
import { ButtonLink } from '../../ui/Button'
import { LiveDot } from '../../ui/Feedback'
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

/** D19 / F47: global supervision of the platform. */
export default function AdminOverviewPage() {
  const now = useNow()
  const serviceName = useServiceName()
  const requests = useRequestStore((s) => s.requests)
  const users = useUserStore((s) => s.users)
  const alerts = useContentStore((s) => s.alerts)
  const interruptions = useCatalogStore((s) => s.interruptions)

  const citizens = users.filter((u) => u.role === 'CITIZEN')
  const activeAlerts = alerts.filter((a) => a.is_active)
  const ongoing = interruptions.filter((i) => new Date(i.starts_at).getTime() <= now && (!i.ends_at || new Date(i.ends_at).getTime() > now))
  const byType = (['CONTACT', 'PROCEDURE', 'INCIDENT'] as const).map((type) => requests.filter((r) => r.type === type).length)

  return (
    <motion.div className={layout.page} variants={stagger} initial="hidden" animate="show">
      <PageHeader simulated
        title="Supervision globale"
        codes={['D19', 'F47']}
        lead="L’état de Terra Nova en un écran : activité des habitants, charge des services, incidents et traçabilité."
        actions={
          <ButtonLink to="/admin/audit" icon="scroll" variant="ghost">
            Journal d’audit
          </ButtonLink>
        }
      />

      <motion.div className={layout.stats} variants={stagger}>
        <StatTile label="Citoyens inscrits" value={citizens.length * 124} icon="users" tone="ice" trend={SPARKS.citizens} delta={{ text: '+8 % sur 7 j', good: true }} />
        <StatTile label="Demandes à traiter" value={requests.filter((r) => NEEDS_ACTION.includes(r.status)).length} icon="inbox" tone="ember" trend={SPARKS.awaiting} />
        <StatTile label="Résolues cette semaine" value={requests.filter((r) => r.status === 'RESOLVED').length + 46} icon="check" tone="ok" trend={SPARKS.resolved} delta={{ text: '+21 %', good: true }} />
        <StatTile label="Délai moyen de prise en charge" value={15} unit="h" icon="clock" tone="progress" trend={SPARKS.delay} delta={{ text: '−4 h', good: true }} />
      </motion.div>

      {(activeAlerts.length > 0 || ongoing.length > 0) && (
        <Panel kicker="Situation en cours" title="Alertes et services perturbés" accent="alert">
          <ul className={styles.situation}>
            {activeAlerts.map((a) => (
              <li key={`a-${a.id}`}>
                <Tag tone={SEVERITY_TONE[a.severity]} pulse={a.severity === 'CRITICAL'}>
                  {SEVERITY_LABEL[a.severity]}
                </Tag>
                <Link to="/admin/alertes">{a.title}</Link>
                <small>
                  {a.notified.toLocaleString('fr-FR')} personnes notifiées · {formatRelative(a.starts_at, now)}
                </small>
              </li>
            ))}
            {ongoing.map((i) => (
              <li key={`i-${i.id}`}>
                <Tag tone={i.impact === 'UNAVAILABLE' ? 'alert' : 'progress'}>{IMPACT_LABEL[i.impact]}</Tag>
                <Link to="/admin/maintenance">{serviceName(i.service_id)}</Link>
                <small>{i.ends_at ? `retour ${formatRelative(i.ends_at, now)}` : 'jusqu’à nouvel ordre'}</small>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className={[layout.grid, layout.split].join(' ')}>
        <Panel kicker="14 derniers jours" title="Demandes reçues et résolues">
          <AreaTrend
            labels={REQUEST_TREND.map((d) => d.label)}
            series={[
              { key: 'received', label: 'Reçues', color: 'var(--series-1)', values: REQUEST_TREND.map((d) => d.received), area: true },
              { key: 'resolved', label: 'Résolues', color: 'var(--series-2)', values: REQUEST_TREND.map((d) => d.resolved) },
            ]}
            summary="Demandes reçues et résolues par jour sur les 14 derniers jours"
          />
        </Panel>
        <Panel kicker="Répartition" title="Types de demandes">
          <DonutRing
            centerLabel="demandes"
            summary="Répartition des demandes par type"
            slices={[
              { label: 'Messages', value: byType[0], color: 'var(--series-1)' },
              { label: 'Démarches', value: byType[1], color: 'var(--series-2)' },
              { label: 'Signalements', value: byType[2], color: 'var(--series-3)' },
            ]}
          />
        </Panel>
      </div>

      <div className={[layout.grid, layout.split].join(' ')}>
        <Panel kicker="Connexions et actions" title="Activité par jour et par heure">
          <Heatmap rows={ACTIVITY_HEATMAP} columns={HEATMAP_HOURS} summary="Intensité d’activité de la plateforme par jour de la semaine et tranche de deux heures" />
        </Panel>
        <Panel kicker="État des demandes" title="Par statut">
          <BarChart
            summary="Nombre de demandes par statut"
            valueHeader="Demandes"
            bars={STATUS_ORDER.map((s) => ({ label: STATUS_LABEL[s], value: requests.filter((r) => r.status === s).length, color: STATUS_COLOR[s] }))}
          />
        </Panel>
      </div>

      <Panel
        kicker="F47 · Traçabilité"
        title="Flux d’audit en direct"
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
    </motion.div>
  )
}
