import { useState } from 'react'
import { motion } from 'motion/react'
import { useDashboardStats, useDashboardTrends } from '../../../api/dashboard'
import { messageFor } from '../../../api/errors'
import { useBulkUpdate, useRequests, type RequestFilters } from '../../../api/requests'
import type { RequestPriority } from '../../../api/types'
import { useStaff } from '../../../api/users'
import { PRIORITY_LABEL } from '../../lib/labels'
import { fullName } from '../../lib/lookups'
import { BarChart } from '../../charts/BarChart'
import { RequestTable } from '../../shared/RequestTable'
import { toast } from '../../stores/toastStore'
import { Button } from '../../ui/Button'
import { FilterChips, Select } from '../../ui/Controls'
import { EmptyState, Skeleton } from '../../ui/Feedback'
import { PageHeader } from '../../ui/PageHeader'
import { Panel } from '../../ui/Panel'
import { StatTile } from '../../ui/StatTile'
import { stagger } from '../../ui/motion'
import layout from '../../ui/layout.module.css'

type Scope = 'action' | 'unassigned' | 'late' | 'all'

const SCOPE_FILTERS: Record<Exclude<Scope, 'late'>, RequestFilters> = {
  action: { scope: 'needs_action', sort: 'priority' },
  unassigned: { scope: 'open', assigned: 'none', sort: 'priority' },
  all: { sort: 'newest' },
}
const LIMIT = 50

/** D17 / F22 / F34: supervise the whole queue — load per agent, delays, (bulk) reassignment. */
export default function RequestsSupervisionPage() {
  const statsQuery = useDashboardStats()
  const stats = statsQuery.data?.requests
  const staff = useStaff().data ?? []
  const pickup = useDashboardTrends(30).data?.pickup_by_service
  const bulk = useBulkUpdate()
  const [scope, setScope] = useState<Scope>('action')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [assignTo, setAssignTo] = useState('')
  const [priority, setPriority] = useState<RequestPriority | ''>('')

  const list = useRequests({ ...(scope === 'late' ? {} : SCOPE_FILTERS[scope]), limit: LIMIT }, scope !== 'late')
  // Overdue: computed by the server with the delays of each priority
  const rows = scope === 'late' ? (stats?.overdue ?? []) : (list.data?.data ?? [])
  const total = scope === 'late' ? stats?.overdue_count : list.data?.meta.total
  const loading = scope === 'late' ? !stats : !list.data
  const finals = ['RESOLVED', 'REJECTED', 'CLOSED'].reduce((sum, s) => sum + (stats?.by_status[s] ?? 0), 0)
  const loadById = new Map((stats?.open_by_agent ?? []).map((row) => [row.agent.id, row.count]))
  const load = staff.map((member) => ({ label: fullName(member), value: loadById.get(member.id) ?? 0 })).sort((a, b) => b.value - a.value)

  const toggle = (id: number) =>
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const visibleSelected = rows.filter((r) => selected.has(r.id)).map((r) => r.id)
  const allChecked = rows.length > 0 && visibleSelected.length === rows.length

  const apply = (changes: { assigned_agent_id?: number | null; priority?: RequestPriority }, done: string) =>
    bulk.mutate(
      { ids: visibleSelected, ...changes },
      {
        onSuccess: ({ updated }) => {
          toast(`${updated} demande${updated > 1 ? 's' : ''} : ${done}`)
          setSelected(new Set())
        },
        onError: (error) => toast(messageFor(error), 'alert'),
      },
    )

  return (
    <motion.div className={layout.page} variants={stagger} initial="hidden" animate="show">
      <PageHeader title="Supervision des demandes" lead="Charge de travail par agent, demandes en retard, et réassignation, une par une ou en groupe." />

      <motion.div className={layout.stats} variants={stagger}>
        <StatTile label="En attente de prise en charge" value={stats?.awaiting_pickup ?? null} icon="clock" tone="ember" hint="D17" />
        <StatTile label="Sans agent" value={stats?.unassigned_open ?? null} icon="user" tone="alert" hint="ouvertes" />
        <StatTile label="En retard" value={stats?.overdue_count ?? null} icon="alert" tone="progress" hint="4 h urgente · 1 j haute · 3 j sinon" />
        <StatTile label="Terminées" value={stats ? finals : null} icon="check" tone="ok" />
      </motion.div>

      <div className={[layout.grid, layout.cols2].join(' ')}>
        <Panel kicker="Charge" title="Demandes à traiter par agent">
          {stats && staff.length ? (
            <BarChart bars={load} summary="Nombre de demandes nécessitant une action assignées à chaque agent" valueHeader="Demandes" />
          ) : (
            <Skeleton lines={5} />
          )}
        </Panel>
        <Panel kicker="30 derniers jours" title="Délai médian de prise en charge par service">
          {!pickup ? (
            <Skeleton lines={5} />
          ) : pickup.length === 0 ? (
            <EmptyState title="Aucune prise en charge sur 30 jours" icon="clock" />
          ) : (
            <BarChart
              bars={pickup.map((s) => ({ label: s.name, value: s.median_hours, color: 'var(--series-2)' }))}
              unit=" h"
              summary="Délai médian entre l’envoi d’une demande et sa première prise en charge, en heures, par service"
              valueHeader="Heures"
            />
          )}
        </Panel>
      </div>

      <Panel
        kicker="File globale"
        title={total === undefined ? 'Demandes' : `${total} demande${total > 1 ? 's' : ''}${total > rows.length ? ` (${rows.length} affichées)` : ''}`}
        flush
        aria-busy={list.isFetching || bulk.isPending}
      >
        <div className={layout.toolbar}>
          <FilterChips<Scope>
            label="Vue"
            value={scope}
            onChange={(value) => {
              setScope(value)
              setSelected(new Set())
            }}
            options={[
              { value: 'action', label: 'À traiter', count: stats?.needs_action },
              { value: 'unassigned', label: 'Sans agent', count: stats?.unassigned_open },
              { value: 'late', label: 'En retard', count: stats?.overdue_count },
              { value: 'all', label: 'Toutes' },
            ]}
          />
        </div>
        <div className={layout.toolbar} role="group" aria-label="Action groupée">
          <span>
            {visibleSelected.length} sélectionnée{visibleSelected.length > 1 ? 's' : ''}
          </span>
          <Select aria-label="Agent pour l’assignation groupée" value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
            <option value="">Assigner à…</option>
            {staff.map((member) => (
              <option key={member.id} value={member.id}>
                {fullName(member)} ({loadById.get(member.id) ?? 0})
              </option>
            ))}
          </Select>
          <Button
            size="sm"
            variant="primary"
            disabled={!assignTo || visibleSelected.length === 0 || bulk.isPending}
            onClick={() => apply({ assigned_agent_id: Number(assignTo) }, `assignées à ${fullName(staff.find((m) => m.id === Number(assignTo)))}`)}
          >
            Assigner
          </Button>
          <Select aria-label="Priorité pour la sélection" value={priority} onChange={(e) => setPriority(e.target.value as RequestPriority | '')}>
            <option value="">Priorité…</option>
            {(['URGENT', 'HIGH', 'NORMAL', 'LOW'] as const).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </Select>
          <Button
            size="sm"
            disabled={!priority || visibleSelected.length === 0 || bulk.isPending}
            onClick={() => priority && apply({ priority }, `priorité ${PRIORITY_LABEL[priority].toLowerCase()}`)}
          >
            Appliquer
          </Button>
        </div>
        {loading ? (
          list.isError ? <EmptyState title={messageFor(list.error)} icon="alert" /> : <Skeleton lines={8} />
        ) : (
          <RequestTable
            requests={rows}
            caption="Supervision des demandes"
            lead={{
              header: 'Sélection',
              cell: (r) => (
                // the row opens the request: the checkbox must not
                <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Sélectionner ${r.reference}`} />
                </span>
              ),
            }}
          />
        )}
        {rows.length > 0 && (
          <div className={layout.toolbar}>
            <Button size="sm" variant="ghost" onClick={() => setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)))}>
              {allChecked ? 'Tout désélectionner' : 'Tout sélectionner'}
            </Button>
          </div>
        )}
      </Panel>
    </motion.div>
  )
}
