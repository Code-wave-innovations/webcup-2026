import { motion } from 'motion/react'
import { Link } from 'react-router'
import { useAuditLogs } from '../../../api/audit'
import { useDashboardStats, useDashboardTrends } from '../../../api/dashboard'
import { messageFor } from '../../../api/errors'
import { useSecurityEvents } from '../../../api/security'
import { useUpdateRequest } from '../../../api/requests'
import { useActor } from '../../layout/persona'
import { formatRelative } from '../../lib/format'
import { useDashboardView } from '../../lib/dashboardView'
import { useNow } from '../../lib/useNow'
import { RadialGauge } from '../../charts/RadialGauge'
import { DashboardViewToggle } from '../../shared/DashboardViewToggle'
import { SimpleDashboard } from '../../shared/SimpleDashboard'
import { AuditFeed } from '../../shared/AuditFeed'
import { SecurityEventList } from '../../shared/SecurityEventList'
import { TerraNovaGlance } from '../../shared/TerraNovaGlance'
import { toast } from '../../stores/toastStore'
import { PriorityTag, Ref, StatusPill } from '../../ui/Badges'
import { Button, ButtonLink } from '../../ui/Button'
import { EmptyState, LiveDot, Skeleton } from '../../ui/Feedback'
import { PageHeader } from '../../ui/PageHeader'
import { Panel } from '../../ui/Panel'
import { StatTile } from '../../ui/StatTile'
import { stagger } from '../../ui/motion'
import layout from '../../ui/layout.module.css'
import styles from './agent.module.css'

/** D19 / F22 / D17 / F50: the agent's workspace at a glance. */
export default function AgentDashboardPage() {
  const actor = useActor()
  const now = useNow()
  const [view, setView] = useDashboardView()
  // F95: the simple view reads its own summary; the detailed panels only load when they are shown
  const detailed = view !== 'simple'
  const statsQuery = useDashboardStats()
  const trends = useDashboardTrends(14, detailed)
  const stats = statsQuery.data
  const requests = stats?.requests
  const queue = stats?.queue ?? []
  // The queue holds the 10 most pressing requests: the urgent new ones are among them
  const urgentAwaiting = queue.filter((r) => r.status === 'SUBMITTED' && r.priority === 'URGENT').length
  const appointmentsSeries = trends.data?.daily.map((d) => d.appointments)
  const activity = useAuditLogs({ limit: 6 }, { live: true, enabled: detailed })
  const security = useSecurityEvents({ days: 1, limit: 5 }, { enabled: detailed })
  const update = useUpdateRequest()
  // the radar turns red when an urgent request has nobody yet
  const urgentUnassigned = queue.some((r) => r.priority === 'URGENT' && r.assigned_agent_id === null)
  const oldest = requests?.oldest_awaiting
  const takeOver = (id: number, reference: string) =>
    update.mutate(
      { id, assigned_agent_id: actor.id },
      { onSuccess: () => toast(`${reference} prise en charge`), onError: (error) => toast(messageFor(error), 'alert') },
    )

  const lead = !requests
    ? 'Chargement de l’activité…'
    : requests.awaiting_pickup === 0
      ? 'Aucune demande n’attend de prise en charge.'
      : `${requests.awaiting_pickup} demande${requests.awaiting_pickup > 1 ? 's attendent' : ' attend'} une prise en charge${urgentAwaiting ? `, dont ${urgentAwaiting} urgente${urgentAwaiting > 1 ? 's' : ''}` : ''}.`

  return (
    <motion.div className={layout.page} variants={stagger} initial="hidden" animate="show">
      <PageHeader
        title={`Bonjour ${actor.name}`}
        lead={lead}
        actions={
          <>
            <DashboardViewToggle value={view} onChange={setView} />
            <ButtonLink to="/agent/demandes" variant="primary" icon="inbox" data-print-hide>
              Ouvrir la file
            </ButtonLink>
          </>
        }
      />

      {view === 'simple' ? (
        <SimpleDashboard base="/agent" indicators={['awaiting_pickup', 'overdue', 'requests_received', 'requests_resolved', 'appointments']} />
      ) : (
        <>
          {statsQuery.isError && !stats && <EmptyState title={messageFor(statsQuery.error)} icon="alert" />}
          <motion.div className={layout.stats} variants={stagger}>
            <StatTile
              label="En attente de prise en charge"
              value={requests?.awaiting_pickup ?? null}
              icon="clock"
              tone="ember"
              hint={oldest ? `la plus ancienne ${formatRelative(oldest.created_at, now)}` : 'D17'}
            />
            <StatTile label="Nécessitent une action" value={requests?.needs_action ?? null} icon="zap" tone="progress" hint={requests ? `dont ${requests.unassigned_open} sans agent` : undefined} />
            <StatTile label="Assignées à moi" value={requests?.assigned_to_me ?? null} icon="user" tone="ice" />
            <StatTile
              label="Rendez-vous aujourd’hui"
              value={stats?.appointments.today ?? null}
              icon="calendar"
              tone="taken"
              trend={appointmentsSeries && appointmentsSeries.length > 1 ? appointmentsSeries : undefined}
            />
          </motion.div>

          <div className={[layout.grid, layout.split].join(' ')}>
            <Panel
              kicker="F22 · Priorité puis ancienneté"
              title="File prioritaire"
              actions={
                <ButtonLink to="/agent/demandes" size="sm" variant="ghost">
                  Toute la file
                </ButtonLink>
              }
            >
              {!stats ? (
                <Skeleton lines={5} />
              ) : queue.length === 0 ? (
                <EmptyState title="Aucune demande à traiter" icon="check" />
              ) : (
                <ul className={styles.oldest}>
                  {queue.slice(0, 6).map((r) => (
                    <li key={r.id}>
                      <Ref>{r.reference}</Ref>
                      <Link to={`/agent/demandes/${r.id}`} className={styles.oldestSubject}>
                        {r.subject}
                      </Link>
                      <StatusPill status={r.status} />
                      <PriorityTag priority={r.priority} />
                      <small>{formatRelative(r.created_at, now)}</small>
                      {r.assigned_agent_id === null && (
                        <Button size="sm" variant="ghost" icon="zap" disabled={update.isPending} onClick={() => takeOver(r.id, r.reference)}>
                          Prendre en charge
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel kicker="D17 · Prise en charge" title="Radar des demandes" accent={urgentUnassigned ? 'alert' : 'ember'}>
              {!requests ? (
                <Skeleton lines={4} />
              ) : (
                <>
                  <RadialGauge
                    value={requests.awaiting_pickup}
                    max={requests.open}
                    label="en attente"
                    tone={requests.awaiting_pickup > 5 ? 'alert' : 'ember'}
                    blips={Array.from({ length: requests.awaiting_pickup }, (_, i) => ({
                      angle: (i * 0.618) % 1,
                      radius: 0.35 + ((i * 0.37) % 0.55),
                      urgent: i < urgentAwaiting,
                    }))}
                  />
                  <p className={layout.sectionLabel}>Les plus anciennes</p>
                  {requests.oldest_awaiting_list.length === 0 ? (
                    <p>Aucune demande en attente.</p>
                  ) : (
                    <ul className={styles.oldest}>
                      {requests.oldest_awaiting_list.map((r) => (
                        <li key={r.id}>
                          <Ref>{r.reference}</Ref>
                          <Link to={`/agent/demandes/${r.id}`} className={styles.oldestSubject}>
                            {r.subject}
                          </Link>
                          <PriorityTag priority={r.priority} />
                          <small>{formatRelative(r.created_at, now)}</small>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </Panel>
          </div>

          <div className={[layout.grid, layout.split].join(' ')}>
            <Panel
              kicker="F47 · F48"
              title="Activité de l’équipe"
              actions={
                <>
                  <LiveDot />
                  <ButtonLink to="/agent/activite" size="sm" variant="ghost">
                    Tout voir
                  </ButtonLink>
                </>
              }
            >
              {activity.data ? (
                <AuditFeed entries={activity.data.data} live />
              ) : activity.isError ? (
                <EmptyState title={messageFor(activity.error)} icon="alert" />
              ) : (
                <Skeleton lines={5} />
              )}
            </Panel>
            <Panel
              kicker="F100 · Sécurité"
              title="Derniers événements de sécurité"
              accent={security.data?.locked_accounts.length ? 'alert' : undefined}
              actions={
                <ButtonLink to="/agent/securite" size="sm" variant="ghost">
                  Tout voir
                </ButtonLink>
              }
            >
              {security.data ? (
                <SecurityEventList events={security.data.data} />
              ) : security.isError ? (
                <EmptyState title={messageFor(security.error)} icon="alert" />
              ) : (
                <Skeleton lines={5} />
              )}
            </Panel>
          </div>

          <TerraNovaGlance />
        </>
      )}
    </motion.div>
  )
}
