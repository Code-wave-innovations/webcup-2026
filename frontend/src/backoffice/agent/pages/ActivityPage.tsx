import { useState } from 'react'
import { motion } from 'motion/react'
import { useActor } from '../../layout/persona'
import { AUDIT_DOMAIN } from '../../lib/labels'
import { AuditFeed } from '../../shared/AuditFeed'
import { useAuditStore } from '../../stores/auditStore'
import { useUserStore } from '../../stores/userStore'
import { FilterChips, Select } from '../../ui/Controls'
import { LiveDot } from '../../ui/Feedback'
import { PageHeader } from '../../ui/PageHeader'
import { Panel } from '../../ui/Panel'
import { StatTile } from '../../ui/StatTile'
import { stagger } from '../../ui/motion'
import layout from '../../ui/layout.module.css'

/** F47 / F48: actions taken by agents, with the history of each modification. */
export default function ActivityPage() {
  const actor = useActor()
  const logs = useAuditStore((s) => s.logs)
  const users = useUserStore((s) => s.users)
  const [scope, setScope] = useState<'mine' | 'team'>('team')
  const [domain, setDomain] = useState('')
  const [agent, setAgent] = useState('')

  const staff = users.filter((u) => u.role !== 'CITIZEN')
  const staffIds = new Set(staff.map((u) => u.id))
  const filtered = logs
    .filter((l) => staffIds.has(l.actor_id))
    .filter((l) => (scope === 'mine' ? l.actor_id === actor.id : true))
    .filter((l) => !agent || String(l.actor_id) === agent)
    .filter((l) => !domain || AUDIT_DOMAIN[l.entity] === domain)
  const mine = logs.filter((l) => l.actor_id === actor.id)
  const domains = [...new Set(Object.values(AUDIT_DOMAIN))]

  return (
    <motion.div className={layout.page} variants={stagger} initial="hidden" animate="show">
      <PageHeader simulated title="Activité & historique" codes={['F47', 'F48']} lead="Qui a modifié quoi, et quand. Chaque changement montre la valeur avant et après." />

      <motion.div className={layout.stats} variants={stagger}>
        <StatTile label="Mes actions" value={mine.length} icon="user" tone="ice" />
        <StatTile label="Actions de l’équipe" value={logs.filter((l) => staffIds.has(l.actor_id)).length} icon="users" tone="taken" />
        <StatTile label="Changements d’état" value={logs.filter((l) => l.action === 'request.status_changed').length} icon="activity" tone="progress" />
      </motion.div>

      <Panel kicker="Journal" title="Historique des modifications" actions={<LiveDot />}>
        <div className={layout.row}>
          <FilterChips<'mine' | 'team'> label="Auteur" value={scope} onChange={setScope} options={[{ value: 'team', label: 'Équipe' }, { value: 'mine', label: 'Moi' }]} />
          <Select aria-label="Agent" value={agent} onChange={(e) => setAgent(e.target.value)} disabled={scope === 'mine'}>
            <option value="">Tous les agents</option>
            {staff.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} {u.last_name}
              </option>
            ))}
          </Select>
          <Select aria-label="Domaine" value={domain} onChange={(e) => setDomain(e.target.value)}>
            <option value="">Tous les domaines</option>
            {domains.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </Select>
        </div>
        <AuditFeed logs={filtered} live />
      </Panel>
    </motion.div>
  )
}
