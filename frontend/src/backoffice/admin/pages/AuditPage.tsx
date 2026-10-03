import { useState } from 'react'
import { motion } from 'motion/react'
import { AUDIT_DOMAIN, AUDIT_LABEL, ROLE_LABEL } from '../../lib/labels'
import { formatDateTime } from '../../lib/format'
import { fullName, useUsersById } from '../../lib/lookups'
import { useNow } from '../../lib/useNow'
import type { AuditLog } from '../../mocks/types'
import { AuditFeed } from '../../shared/AuditFeed'
import { useAuditStore } from '../../stores/auditStore'
import { toast } from '../../stores/toastStore'
import { Button } from '../../ui/Button'
import { FilterChips, SearchInput, Select } from '../../ui/Controls'
import { LiveDot } from '../../ui/Feedback'
import { PageHeader } from '../../ui/PageHeader'
import { Panel } from '../../ui/Panel'
import { StatTile } from '../../ui/StatTile'
import { stagger } from '../../ui/motion'
import layout from '../../ui/layout.module.css'

type Period = 'hour' | 'day' | 'week' | 'all'
const PERIOD_MS: Record<Period, number> = { hour: 3_600_000, day: 86_400_000, week: 7 * 86_400_000, all: Infinity }

/** F47 / F48: the audit trail — who changed what, when and from where. */
export default function AuditPage() {
  const now = useNow()
  const users = useUsersById()
  const logs = useAuditStore((s) => s.logs)
  const [query, setQuery] = useState('')
  const [actor, setActor] = useState('')
  const [domain, setDomain] = useState('')
  const [period, setPeriod] = useState<Period>('all')

  const q = query.trim().toLowerCase()
  const filtered = logs
    .filter((l) => now - new Date(l.at).getTime() <= PERIOD_MS[period])
    .filter((l) => !actor || String(l.actor_id) === actor)
    .filter((l) => !domain || AUDIT_DOMAIN[l.entity] === domain)
    .filter((l) => !q || `${l.entity_label} ${AUDIT_LABEL[l.action]} ${l.ip} ${l.changes.map((c) => `${c.field} ${c.before} ${c.after}`).join(' ')}`.toLowerCase().includes(q))
  const actors = [...new Set(logs.map((l) => l.actor_id))].map((id) => users.get(id)).filter((u) => u !== undefined)
  const domains = [...new Set(Object.values(AUDIT_DOMAIN))]
  const sensitive = logs.filter((l) => ['user.role_changed', 'role.permission_changed', 'settings.updated', 'user.deactivated'].includes(l.action))

  const exportCsv = (rows: AuditLog[]) => {
    const csv = [
      'date;auteur;action;cible;changements;ip',
      ...rows.map((l) =>
        [formatDateTime(l.at), fullName(users.get(l.actor_id)), l.action, l.entity_label, l.changes.map((c) => `${c.field}:${c.before ?? ''}→${c.after ?? ''}`).join(' | '), l.ip].join(';'),
      ),
    ].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'journal-audit.csv'
    link.click()
    URL.revokeObjectURL(url)
    toast(`${rows.length} entrées exportées`, 'info')
  }

  return (
    <motion.div className={layout.page} variants={stagger} initial="hidden" animate="show">
      <PageHeader simulated
        title="Journal d’audit"
        codes={['F47', 'F48']}
        lead="Chaque modification est horodatée et attribuée : qui, quoi, quand, depuis quelle adresse, et la valeur avant/après."
        actions={
          <Button icon="download" onClick={() => exportCsv(filtered)}>
            Exporter (CSV)
          </Button>
        }
      />

      <motion.div className={layout.stats} variants={stagger}>
        <StatTile label="Entrées" value={logs.length} icon="scroll" tone="ice" />
        <StatTile label="Dernière heure" value={logs.filter((l) => now - new Date(l.at).getTime() < 3_600_000).length} icon="clock" tone="taken" />
        <StatTile label="Actions sensibles" value={sensitive.length} icon="key" tone="ember" hint="rôles, droits, paramètres" />
        <StatTile label="Auteurs distincts" value={actors.length} icon="users" tone="neutral" />
      </motion.div>

      <Panel kicker="Traçabilité" title={`${filtered.length} action${filtered.length > 1 ? 's' : ''}`} actions={<LiveDot />}>
        <div className={layout.row}>
          <div style={{ flex: '1 1 260px' }}>
            <SearchInput label="Cible, champ, valeur, IP… (touche /)" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <Select aria-label="Auteur" value={actor} onChange={(e) => setActor(e.target.value)}>
            <option value="">Tous les auteurs</option>
            {actors.map((u) => (
              <option key={u.id} value={u.id}>
                {fullName(u)} ({ROLE_LABEL[u.role]})
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
        <FilterChips<Period>
          label="Période"
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'hour', label: '1 h' },
            { value: 'day', label: '24 h' },
            { value: 'week', label: '7 j' },
            { value: 'all', label: 'Tout' },
          ]}
        />
        <AuditFeed logs={filtered} live showIp />
      </Panel>
    </motion.div>
  )
}
