import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { motion } from 'motion/react'
import { useDashboardStats } from '../../../api/dashboard'
import { messageFor } from '../../../api/errors'
import { useRequests, type RequestFilters } from '../../../api/requests'
import type { RequestPriority, RequestType } from '../../../api/types'
import { usePersona } from '../../layout/persona'
import { PRIORITY_LABEL, TYPE_LABEL } from '../../lib/labels'
import { RequestTable } from '../../shared/RequestTable'
import { Button } from '../../ui/Button'
import { FilterChips, SearchInput, Select } from '../../ui/Controls'
import { EmptyState, Skeleton } from '../../ui/Feedback'
import { PageHeader } from '../../ui/PageHeader'
import { Panel } from '../../ui/Panel'
import { stagger } from '../../ui/motion'
import layout from '../../ui/layout.module.css'

const PAGE_SIZE = 20

type Chip = 'action' | 'attente' | 'moi' | 'non-assignees' | 'cloturees' | 'toutes'

/** Each chip as API filters (F22, D17). */
const CHIP_FILTERS: Record<Chip, RequestFilters> = {
  action: { scope: 'needs_action' },
  attente: { status: ['SUBMITTED'] },
  moi: { scope: 'needs_action', assigned: 'me' },
  'non-assignees': { scope: 'open', assigned: 'none' },
  cloturees: { scope: 'closed' },
  toutes: {},
}
const CHIPS = Object.keys(CHIP_FILTERS) as Chip[]
const SORTS = ['newest', 'oldest', 'priority', 'updated'] as const
const PRIORITIES: RequestPriority[] = ['URGENT', 'HIGH', 'NORMAL', 'LOW']

const sum = (values: Record<string, number> | undefined, keys: string[]) => keys.reduce((total, key) => total + (values?.[key] ?? 0), 0)

/** F22: every citizen request, filterable by state, with "needs action" one click away. Filters live in the URL. */
export default function RequestsPage() {
  const persona = usePersona()
  const [params, setParams] = useSearchParams()
  const chip = CHIPS.includes(params.get('etat') as Chip) ? (params.get('etat') as Chip) : 'action'
  const type = (params.get('type') ?? '') as RequestType | ''
  const priority = (params.get('priorite') ?? '') as RequestPriority | ''
  const sort = SORTS.find((s) => s === params.get('tri')) ?? 'newest'
  const q = params.get('q') ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)

  const update = (changes: Record<string, string | null>, keepPage = false) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value)
          else next.delete(key)
        }
        if (!keepPage) next.delete('page')
        return next
      },
      { replace: true },
    )

  // The search reaches the URL (and the server) once typing pauses
  const [search, setSearch] = useState(q)
  useEffect(() => {
    if (search.trim() === q) return
    const timer = setTimeout(() => update({ q: search.trim() || null }), 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the typed text restarts the timer
  }, [search])

  const filters: RequestFilters = {
    ...CHIP_FILTERS[chip],
    type: type || undefined,
    priority: priority || undefined,
    q: q || undefined,
    sort,
    page,
    limit: PAGE_SIZE,
  }
  const list = useRequests(filters)
  const stats = useDashboardStats().data?.requests
  const byStatus = stats?.by_status
  const counts: Record<Chip, number | undefined> = {
    action: stats?.needs_action,
    attente: stats?.awaiting_pickup,
    moi: stats?.assigned_to_me,
    'non-assignees': stats?.unassigned_open,
    cloturees: stats && sum(byStatus, ['RESOLVED', 'REJECTED', 'CLOSED']),
    toutes: stats && sum(byStatus, Object.keys(byStatus ?? {})),
  }
  const labels: Record<Chip, string> = {
    action: 'Nécessitent une action',
    attente: 'En attente de prise en charge',
    moi: 'À moi',
    'non-assignees': 'Non assignées',
    cloturees: 'Clôturées',
    toutes: 'Toutes',
  }
  const meta = list.data?.meta

  return (
    <motion.div className={layout.page} variants={stagger} initial="hidden" animate="show">
      <PageHeader
        title={persona === 'ADMIN' ? 'Toutes les demandes' : 'Demandes citoyennes'}
        codes={['F22', 'D17', 'D04']}
        lead={
          stats
            ? `${stats.awaiting_pickup} demande${stats.awaiting_pickup > 1 ? 's attendent' : ' attend'} une prise en charge. Les urgentes sont marquées en rouge, les nouvelles en ambre, les retards d’une horloge.`
            : 'Les demandes urgentes sont marquées en rouge, celles qui attendent une prise en charge en ambre.'
        }
      />

      <FilterChips<Chip>
        label="Filtrer par état"
        value={chip}
        onChange={(value) => update({ etat: value === 'action' ? null : value })}
        options={CHIPS.map((value) => ({ value, label: labels[value], count: counts[value] }))}
      />

      <Panel
        flush
        title={meta ? `${meta.total} demande${meta.total > 1 ? 's' : ''}` : 'Demandes'}
        kicker="File de traitement"
        aria-busy={list.isFetching}
      >
        <div className={layout.toolbar}>
          <SearchInput label="Rechercher une référence, un sujet, un e-mail… (touche /)" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select aria-label="Type de demande" value={type} onChange={(e) => update({ type: e.target.value || null })}>
            <option value="">Tous les types</option>
            {(Object.keys(TYPE_LABEL) as RequestType[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
          <Select aria-label="Priorité" value={priority} onChange={(e) => update({ priorite: e.target.value || null })}>
            <option value="">Toutes priorités</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </Select>
          <Select aria-label="Trier" value={sort} onChange={(e) => update({ tri: e.target.value === 'newest' ? null : e.target.value })}>
            <option value="newest">Plus récentes d’abord</option>
            <option value="oldest">Plus anciennes d’abord</option>
            <option value="priority">Priorité, puis ancienneté</option>
            <option value="updated">Dernière mise à jour</option>
          </Select>
        </div>
        {list.data ? (
          <RequestTable requests={list.data.data} caption="Demandes citoyennes filtrées" />
        ) : list.isError ? (
          <EmptyState title={messageFor(list.error)} icon="alert" />
        ) : (
          <Skeleton lines={8} />
        )}
        {meta && meta.pages > 1 && (
          <nav className={layout.toolbar} aria-label="Pages">
            <Button size="sm" icon="chevronLeft" disabled={page <= 1} onClick={() => update({ page: String(page - 1) }, true)}>
              Précédente
            </Button>
            <span aria-current="page">
              Page {meta.page} sur {meta.pages}
            </span>
            <Button size="sm" disabled={page >= meta.pages} onClick={() => update({ page: String(page + 1) }, true)}>
              Suivante
            </Button>
          </nav>
        )}
      </Panel>
    </motion.div>
  )
}
