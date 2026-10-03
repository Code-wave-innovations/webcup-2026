import { motion } from 'motion/react'
import { useActor } from '../../layout/persona'
import { NEEDS_ACTION, PRIORITY_RANK } from '../../lib/labels'
import { formatRelative } from '../../lib/format'
import { useNow } from '../../lib/useNow'
import { SPARKS } from '../../mocks/stats'
import { TERRA_NOVA_FEED } from '../../mocks/terraNova'
import { LOADED_AT } from '../../mocks/time'
import { RadialGauge } from '../../charts/RadialGauge'
import { AuditFeed } from '../../shared/AuditFeed'
import { RequestTable } from '../../shared/RequestTable'
import { TerraNovaCard } from '../../shared/TerraNovaCard'
import { useAppointmentStore } from '../../stores/appointmentStore'
import { useAuditStore } from '../../stores/auditStore'
import { useRequestStore } from '../../stores/requestStore'
import { PriorityTag, Ref } from '../../ui/Badges'
import { ButtonLink } from '../../ui/Button'
import { LiveDot } from '../../ui/Feedback'
import { PageHeader } from '../../ui/PageHeader'
import { Panel } from '../../ui/Panel'
import { StatTile } from '../../ui/StatTile'
import { stagger } from '../../ui/motion'
import layout from '../../ui/layout.module.css'
import styles from './agent.module.css'

/** D19 / F22 / D17: the agent's workspace at a glance. */
export default function AgentDashboardPage() {
  const actor = useActor()
  const now = useNow()
  const requests = useRequestStore((s) => s.requests)
  const logs = useAuditStore((s) => s.logs)
  const appointments = useAppointmentStore((s) => s.appointments)
  const slots = useAppointmentStore((s) => s.slots)

  const awaiting = requests.filter((r) => r.status === 'SUBMITTED')
  const needsAction = requests.filter((r) => NEEDS_ACTION.includes(r.status))
  const mine = needsAction.filter((r) => r.assigned_agent_id === actor.id)
  const open = requests.filter((r) => !r.resolved_at)
  const today = new Date(now).toDateString()
  const todaySlots = new Set(slots.filter((s) => new Date(s.starts_at).toDateString() === today).map((s) => s.id))
  const todayAppointments = appointments.filter((a) => a.status === 'BOOKED' && todaySlots.has(a.slot_id))
  const queue = [...needsAction]
    .sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] || a.created_at.localeCompare(b.created_at))
    .slice(0, 6)
  const oldest = [...awaiting].sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(0, 3)

  const nextWaveAt = LOADED_AT + TERRA_NOVA_FEED.session.minutes_until_next_wave * 60_000
  const remaining = Math.max(0, nextWaveAt - now)
  const countdown = `${String(Math.floor(remaining / 60_000)).padStart(2, '0')}:${String(Math.floor((remaining % 60_000) / 1000)).padStart(2, '0')}`
  const latestWave = TERRA_NOVA_FEED.requests.filter((r) => r.wave_number === TERRA_NOVA_FEED.session.current_wave)

  return (
    <motion.div className={layout.page} variants={stagger} initial="hidden" animate="show">
      <PageHeader
        title={`Bonjour ${actor.name}`}
        codes={['D19', 'F22', 'D17']}
        lead={`${awaiting.length} demande${awaiting.length > 1 ? 's attendent' : ' attend'} une prise en charge, dont ${awaiting.filter((r) => r.priority === 'URGENT').length} urgente(s).`}
        actions={
          <ButtonLink to="/agent/demandes" variant="primary" icon="inbox">
            Ouvrir la file
          </ButtonLink>
        }
      />

      <motion.div className={layout.stats} variants={stagger}>
        <StatTile label="En attente de prise en charge" value={awaiting.length} icon="clock" tone="ember" trend={SPARKS.awaiting} hint="D17" />
        <StatTile label="Nécessitent une action" value={needsAction.length} icon="zap" tone="progress" hint="nouvelles, en examen, en traitement" />
        <StatTile label="Assignées à moi" value={mine.length} icon="user" tone="ice" />
        <StatTile label="Rendez-vous aujourd’hui" value={todayAppointments.length} icon="calendar" tone="taken" trend={SPARKS.appointments} />
      </motion.div>

      <div className={[layout.grid, layout.split].join(' ')}>
        <Panel
          kicker="F22 · Priorité puis ancienneté"
          title="File prioritaire"
          flush
          actions={
            <ButtonLink to="/agent/demandes" size="sm" variant="ghost">
              Toute la file
            </ButtonLink>
          }
        >
          <RequestTable requests={queue} caption="Demandes à traiter en priorité" compact />
        </Panel>

        <Panel kicker="D17 · Prise en charge" title="Radar des demandes" accent={awaiting.some((r) => r.priority === 'URGENT') ? 'alert' : 'ember'}>
          <RadialGauge
            value={awaiting.length}
            max={open.length}
            label="en attente"
            tone={awaiting.length > 5 ? 'alert' : 'ember'}
            blips={awaiting.map((r, i) => ({ angle: (i * 0.618) % 1, radius: 0.35 + ((i * 0.37) % 0.55), urgent: r.priority === 'URGENT' }))}
          />
          <p className={layout.sectionLabel}>Les plus anciennes</p>
          <ul className={styles.oldest}>
            {oldest.map((r) => (
              <li key={r.id}>
                <Ref>{r.reference}</Ref>
                <span className={styles.oldestSubject}>{r.subject}</span>
                <PriorityTag priority={r.priority} />
                <small>{formatRelative(r.created_at, now)}</small>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className={[layout.grid, layout.split].join(' ')}>
        <Panel kicker="F47 · F48" title="Activité de l’équipe" actions={<LiveDot />}>
          <AuditFeed logs={logs.slice(0, 6)} live />
        </Panel>

        <Panel
          kicker="D19 · API officielle"
          title={`Nova Terra — vague ${TERRA_NOVA_FEED.session.current_wave}`}
          accent="ice"
          actions={
            <ButtonLink to="/agent/nova-terra" size="sm" variant="ghost" icon="satellite">
              Flux complet
            </ButtonLink>
          }
        >
          <div className={styles.wave}>
            <div>
              <p className={layout.sectionLabel}>Prochaine vague dans</p>
              <p className={styles.countdown} aria-live="off">
                {countdown}
              </p>
            </div>
            <div>
              <p className={layout.sectionLabel}>Demandes visibles</p>
              <p className={styles.countdown}>{TERRA_NOVA_FEED.session.visible_requests_count}</p>
            </div>
          </div>
          <div className={layout.stack}>
            {latestWave.slice(0, 2).map((r) => (
              <TerraNovaCard key={r.id} request={r} fresh />
            ))}
          </div>
        </Panel>
      </div>
    </motion.div>
  )
}
