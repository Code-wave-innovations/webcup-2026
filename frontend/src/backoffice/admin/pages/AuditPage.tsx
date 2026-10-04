import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { motion } from 'motion/react'
import { downloadAuditCsv, useAuditLogs, useAuditStats, type AuditFilters } from '../../../api/audit'
import { messageFor } from '../../../api/errors'
import { useStaff } from '../../../api/users'
import { ACTION_FAMILIES, ENTITIES } from '../../lib/auditText'
import { fullName } from '../../lib/lookups'
import { PERIODS, periodFrom, type Period } from '../../lib/periods'
import { useNow } from '../../lib/useNow'
import { AuditFeed } from '../../shared/AuditFeed'
import { toast } from '../../stores/toastStore'
import { Button } from '../../ui/Button'
import { FilterChips, SearchInput, Select } from '../../ui/Controls'
import { EmptyState, LiveDot, Skeleton } from '../../ui/Feedback'
import { PageHeader } from '../../ui/PageHeader'
import { Panel } from '../../ui/Panel'
import { StatTile } from '../../ui/StatTile'
import { stagger } from '../../ui/motion'
import layout from '../../ui/layout.module.css'

const PAGE_SIZE = 30

/** F47 / F48: the audit trail — who changed what, when and from where. Filters live in the URL. */
export default function AuditPage() {
  const now = useNow()
  const [params, setParams] = useSearchParams()
  const actorId = Number(params.get('acteur')) || undefined
  const entity = params.get('objet') ?? ''
  const action = params.get('action') ?? ''
  const period = (PERIODS.find((p) => p.value === params.get('periode'))?.value ?? 'tout') as Period
  const q = params.get('q') ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [exporting, setExporting] = useState(false)

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

  const [search, setSearch] = useState(q)
  useEffect(() => {
    if (search.trim() === q) return
    const timer = setTimeout(() => update({ q: search.trim() || null }), 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the typed text restarts the timer
  }, [search])

  const filters: Omit<AuditFilters, 'page' | 'limit'> = {
    actor_id: actorId,
    entity: entity || undefined,
    action: action || undefined,
    from: periodFrom(period, now),
    q: q || undefined,
  }
  const list = useAuditLogs({ ...filters, page, limit: PAGE_SIZE }, { live: page === 1 })
  const stats = useAuditStats(14)
  const security = useAuditLogs({ action: 'security.', limit: 1 })
  const staff = useStaff().data ?? []
  const meta = list.data?.meta

  const exportCsv = async () => {
    setExporting(true)
    try {
      await downloadAuditCsv(filters)
      toast(`Journal exporté (${meta?.total ?? 0} entrées)`, 'info')
    } catch (error) {
      toast(messageFor(error), 'alert')
    } finally {
      setExporting(false)
    }
  }

  return (
    <motion.div className={layout.page} variants={stagger} initial="hidden" animate="show">
      <PageHeader
        title="Journal d’audit"
        codes={['F47', 'F48']}
        lead="Chaque action est horodatée et attribuée : qui, quoi, quand, depuis quelle adresse, et la valeur avant/après. Le journal ne se modifie ni ne se purge."
        actions={
          <Button icon="download" onClick={() => void exportCsv()} disabled={exporting} aria-busy={exporting}>
            {exporting ? 'Export…' : 'Exporter (CSV)'}
          </Button>
        }
      />

      <motion.div className={layout.stats} variants={stagger}>
        <StatTile label="Actions (14 j)" value={stats.data?.total ?? null} icon="scroll" tone="ice" />
        <StatTile label="Aujourd’hui" value={stats.data ? (stats.data.per_day.at(-1)?.count ?? 0) : null} icon="clock" tone="taken" />
        <StatTile label="Actions de sécurité" value={security.data?.meta.total ?? null} icon="key" tone="ember" hint="connexions, double vérification, sessions" />
        <StatTile label="Auteurs (14 j)" value={stats.data?.per_actor.length ?? null} icon="users" tone="neutral" />
      </motion.div>

      <Panel kicker="Traçabilité" title={meta ? `${meta.total} action${meta.total > 1 ? 's' : ''}` : 'Actions'} actions={<LiveDot />} aria-busy={list.isFetching}>
        <div className={layout.row}>
          <div style={{ flex: '1 1 260px' }}>
            <SearchInput label="Objet, auteur, action… (touche /)" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select aria-label="Auteur" value={actorId ?? ''} onChange={(e) => update({ acteur: e.target.value || null })}>
            <option value="">Tous les auteurs</option>
            {staff.map((member) => (
              <option key={member.id} value={member.id}>
                {fullName(member)}
              </option>
            ))}
          </Select>
          <Select aria-label="Objet" value={entity} onChange={(e) => update({ objet: e.target.value || null })}>
            <option value="">Tous les objets</option>
            {ENTITIES.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label}
              </option>
            ))}
          </Select>
          <Select aria-label="Action" value={action} onChange={(e) => update({ action: e.target.value || null })}>
            <option value="">Toutes les actions</option>
            {ACTION_FAMILIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
        </div>
        <FilterChips<Period>
          label="Période"
          value={period}
          onChange={(value) => update({ periode: value === 'tout' ? null : value })}
          options={PERIODS.map((p) => ({ value: p.value, label: p.label }))}
        />
        {list.data ? (
          <AuditFeed entries={list.data.data} live={page === 1} showIp />
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
