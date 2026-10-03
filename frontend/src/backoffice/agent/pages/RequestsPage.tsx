import { useState } from 'react'
import { motion } from 'motion/react'
import { useActor, usePersona } from '../../layout/persona'
import { FINAL_STATUSES, NEEDS_ACTION, STATUS_LABEL, TYPE_LABEL } from '../../lib/labels'
import type { RequestPriority, RequestStatus, RequestType } from '../../mocks/types'
import { RequestTable } from '../../shared/RequestTable'
import { useRequestStore } from '../../stores/requestStore'
import { FilterChips, SearchInput, Select, Toggle } from '../../ui/Controls'
import { PageHeader } from '../../ui/PageHeader'
import { Panel } from '../../ui/Panel'
import { stagger } from '../../ui/motion'
import layout from '../../ui/layout.module.css'

type Scope = 'action' | 'all' | 'closed' | RequestStatus

/** F22: every citizen request, filterable by state, with "needs action" one click away. */
export default function RequestsPage() {
  const actor = useActor()
  const persona = usePersona()
  const requests = useRequestStore((s) => s.requests)
  const [scope, setScope] = useState<Scope>('action')
  const [query, setQuery] = useState('')
  const [type, setType] = useState<RequestType | ''>('')
  const [priority, setPriority] = useState<RequestPriority | ''>('')
  const [mine, setMine] = useState(false)

  const count = (predicate: (s: RequestStatus) => boolean) => requests.filter((r) => predicate(r.status)).length
  const chips: { value: Scope; label: string; count: number }[] = [
    { value: 'action', label: 'Nécessitent une action', count: count((s) => NEEDS_ACTION.includes(s)) },
    { value: 'SUBMITTED', label: STATUS_LABEL.SUBMITTED, count: count((s) => s === 'SUBMITTED') },
    { value: 'IN_REVIEW', label: STATUS_LABEL.IN_REVIEW, count: count((s) => s === 'IN_REVIEW') },
    { value: 'IN_PROGRESS', label: STATUS_LABEL.IN_PROGRESS, count: count((s) => s === 'IN_PROGRESS') },
    { value: 'WAITING_CITIZEN', label: STATUS_LABEL.WAITING_CITIZEN, count: count((s) => s === 'WAITING_CITIZEN') },
    { value: 'closed', label: 'Terminées', count: count((s) => FINAL_STATUSES.includes(s)) },
    { value: 'all', label: 'Toutes', count: requests.length },
  ]

  const q = query.trim().toLowerCase()
  const filtered = requests
    .filter((r) => {
      if (scope === 'action') return NEEDS_ACTION.includes(r.status)
      if (scope === 'closed') return FINAL_STATUSES.includes(r.status)
      if (scope === 'all') return true
      return r.status === scope
    })
    .filter((r) => !type || r.type === type)
    .filter((r) => !priority || r.priority === priority)
    .filter((r) => !mine || r.assigned_agent_id === actor.id)
    .filter((r) => !q || `${r.reference} ${r.subject} ${r.message} ${r.contact_name ?? ''}`.toLowerCase().includes(q))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))

  return (
    <motion.div className={layout.page} variants={stagger} initial="hidden" animate="show">
      <PageHeader simulated
        title={persona === 'ADMIN' ? 'Toutes les demandes' : 'Demandes citoyennes'}
        codes={['F22', 'D17']}
        lead="Les demandes urgentes sont marquées en rouge, celles qui attendent une prise en charge en ambre."
      />

      <FilterChips label="Filtrer par état" options={chips} value={scope} onChange={setScope} />

      <Panel flush title={`${filtered.length} demande${filtered.length > 1 ? 's' : ''}`} kicker="File de traitement">
        <div className={layout.toolbar}>
          <SearchInput label="Rechercher une référence, un sujet… (touche /)" value={query} onChange={(e) => setQuery(e.target.value)} />
          <Select aria-label="Type de demande" value={type} onChange={(e) => setType(e.target.value as RequestType | '')}>
            <option value="">Tous les types</option>
            {(Object.keys(TYPE_LABEL) as RequestType[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
          <Select aria-label="Priorité" value={priority} onChange={(e) => setPriority(e.target.value as RequestPriority | '')}>
            <option value="">Toutes priorités</option>
            <option value="URGENT">Urgente</option>
            <option value="HIGH">Haute</option>
            <option value="NORMAL">Normale</option>
            <option value="LOW">Basse</option>
          </Select>
          <Toggle checked={mine} onChange={setMine} label="Assignées à moi" />
        </div>
        <RequestTable requests={filtered} caption="Demandes citoyennes filtrées" />
      </Panel>
    </motion.div>
  )
}
