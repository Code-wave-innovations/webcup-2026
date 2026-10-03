import { useState } from 'react'
import { motion } from 'motion/react'
import { useActor } from '../../layout/persona'
import { FINAL_STATUSES, NEEDS_ACTION } from '../../lib/labels'
import { fullName, useUsersById } from '../../lib/lookups'
import { useNow } from '../../lib/useNow'
import { HANDLING_TIME, SPARKS } from '../../mocks/stats'
import { BarChart } from '../../charts/BarChart'
import { RequestTable } from '../../shared/RequestTable'
import { assignRequest, useRequestStore } from '../../stores/requestStore'
import { Button } from '../../ui/Button'
import { FilterChips, Select } from '../../ui/Controls'
import { PageHeader } from '../../ui/PageHeader'
import { Panel } from '../../ui/Panel'
import { StatTile } from '../../ui/StatTile'
import { stagger } from '../../ui/motion'
import layout from '../../ui/layout.module.css'

type Scope = 'unassigned' | 'action' | 'late' | 'all'

/** D17 / F34: supervise the whole queue — load per agent, delays, reassignment. */
export default function RequestsSupervisionPage() {
  const actor = useActor()
  const now = useNow()
  const users = useUsersById()
  const requests = useRequestStore((s) => s.requests)
  const [scope, setScope] = useState<Scope>('action')
  const [assignTo, setAssignTo] = useState('')

  const agents = [...users.values()].filter((u) => u.role !== 'CITIZEN' && u.is_active)
  const open = requests.filter((r) => NEEDS_ACTION.includes(r.status))
  const late = open.filter((r) => now - new Date(r.created_at).getTime() > 24 * 3_600_000)
  const unassigned = open.filter((r) => !r.assigned_agent_id)
  const rows = scope === 'unassigned' ? unassigned : scope === 'late' ? late : scope === 'action' ? open : requests
  const load = agents.map((a) => ({ label: fullName(a), value: open.filter((r) => r.assigned_agent_id === a.id).length }))

  const bulkAssign = () => {
    if (!assignTo) return
    unassigned.forEach((r) => assignRequest(r.id, Number(assignTo), actor.id))
  }

  return (
    <motion.div className={layout.page} variants={stagger} initial="hidden" animate="show">
      <PageHeader simulated title="Supervision des demandes" codes={['D17', 'F22', 'F34']} lead="Charge de travail par agent, demandes en retard, et réassignation en un clic." />

      <motion.div className={layout.stats} variants={stagger}>
        <StatTile label="En attente de prise en charge" value={requests.filter((r) => r.status === 'SUBMITTED').length} icon="clock" tone="ember" trend={SPARKS.awaiting} />
        <StatTile label="Sans agent" value={unassigned.length} icon="user" tone="alert" />
        <StatTile label="En retard (> 24 h)" value={late.length} icon="alert" tone="progress" />
        <StatTile label="Terminées" value={requests.filter((r) => FINAL_STATUSES.includes(r.status)).length} icon="check" tone="ok" trend={SPARKS.resolved} />
      </motion.div>

      <div className={[layout.grid, layout.cols2].join(' ')}>
        <Panel kicker="Charge" title="Demandes ouvertes par agent">
          <BarChart bars={load} summary="Nombre de demandes ouvertes assignées à chaque agent" valueHeader="Demandes ouvertes" />
        </Panel>
        <Panel kicker="30 derniers jours" title="Délai moyen de traitement par service">
          <BarChart bars={HANDLING_TIME.map((h) => ({ ...h, color: 'var(--series-2)' }))} unit=" h" summary="Délai moyen de traitement en heures par service" valueHeader="Heures" />
        </Panel>
      </div>

      <Panel
        kicker="File globale"
        title={`${rows.length} demande${rows.length > 1 ? 's' : ''}`}
        flush
        actions={
          scope === 'unassigned' &&
          unassigned.length > 0 && (
            <span className={layout.row}>
              <Select aria-label="Agent pour l’assignation groupée" value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
                <option value="">Choisir un agent…</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {fullName(a)}
                  </option>
                ))}
              </Select>
              <Button size="sm" variant="primary" disabled={!assignTo} onClick={bulkAssign}>
                Tout assigner
              </Button>
            </span>
          )
        }
      >
        <div className={layout.toolbar}>
          <FilterChips<Scope>
            label="Vue"
            value={scope}
            onChange={setScope}
            options={[
              { value: 'action', label: 'À traiter', count: open.length },
              { value: 'unassigned', label: 'Sans agent', count: unassigned.length },
              { value: 'late', label: 'En retard', count: late.length },
              { value: 'all', label: 'Toutes', count: requests.length },
            ]}
          />
        </div>
        <RequestTable requests={rows} caption="Supervision des demandes" />
      </Panel>
    </motion.div>
  )
}
