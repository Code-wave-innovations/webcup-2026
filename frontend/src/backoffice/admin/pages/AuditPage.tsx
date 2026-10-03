import { useDeferredValue } from 'react'
import { useSearchParams } from 'react-router'
import { motion } from 'motion/react'
import { downloadAuditCsv, useAuditLogs } from '../../../api/audit'
import type { AuditFilters } from '../../../api/auditFilters'
import { messageFor } from '../../../api/errors'
import { AUDIT_LABEL, ROLE_LABEL, auditDomains, entitiesForDomain } from '../../lib/labels'
import { AuditFeed, AuditPager } from '../../shared/AuditFeed'
import { toast } from '../../stores/toastStore'
import { Button } from '../../ui/Button'
import { FilterChips, SearchInput, Select } from '../../ui/Controls'
import { EmptyState, LiveDot, Skeleton } from '../../ui/Feedback'
import { PageHeader } from '../../ui/PageHeader'
import { Panel } from '../../ui/Panel'
import { StatTile } from '../../ui/StatTile'
import { stagger } from '../../ui/motion'
import layout from '../../ui/layout.module.css'

type Period = 'hour' | 'day' | 'week' | 'all'

const ACTIONS = Object.entries(AUDIT_LABEL)

/** F47 / F48: the full audit journal, filtered from the URL and exportable. */
export default function AuditPage() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const deferredQ = useDeferredValue(q)
  const actor = params.get('actor') ?? ''
  const domain = params.get('domain') ?? ''
  const action = params.get('action') ?? ''
  const period = (params.get('period') as Period) || 'all'
  const page = Math.max(1, Number(params.get('page') || '1') || 1)

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (!value) next.delete(key)
    else next.set(key, value)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }

  const filters: AuditFilters = {
    actor_id: actor ? Number(actor) : undefined,
    entity: domain ? entitiesForDomain(domain) : undefined,
    action: action || undefined,
    q: deferredQ.trim() || undefined,
    period,
    page,
    limit: 25,
  }
  const list = useAuditLogs(filters, { live: true })
  const overview = useAuditLogs({ summary: true, facets: true, limit: 1, period }, { live: true })

  const exportCsv = async () => {
    try {
      const result = await downloadAuditCsv({ ...filters, page: undefined, limit: undefined })
      toast(result.truncated ? 'Les 10 000 entrées les plus récentes ont été exportées' : 'Journal exporté', 'info')
    } catch (error) {
      toast(error instanceof Error ? error.message : messageFor(error), 'alert')
    }
  }

  const actors = overview.data?.actors ?? []
  const summary = overview.data?.summary
  const rows = list.data?.data ?? []
  const meta = list.data?.meta

  return (
    <motion.div className={layout.page} variants={stagger} initial="hidden" animate="show">
      <PageHeader
        title="Journal d’audit"
        codes={['F47', 'F48']}
        lead="Chaque modification est horodatée et attribuée : qui, quoi, quand, depuis quelle adresse, et la valeur avant/après."
        actions={
          <Button icon="download" onClick={() => void exportCsv()}>
            Exporter (CSV)
          </Button>
        }
      />

      <motion.div className={layout.stats} variants={stagger}>
        <StatTile label="Entrées" value={summary?.total ?? 0} icon="scroll" tone="ice" />
        <StatTile label="Dernière heure" value={summary?.last_hour ?? 0} icon="clock" tone="taken" />
        <StatTile label="Actions sensibles" value={summary?.sensitive ?? 0} icon="key" tone="ember" hint="rôles, comptes, paramètres" />
        <StatTile label="Auteurs distincts" value={actors.length} icon="users" tone="neutral" />
      </motion.div>

      <Panel
        kicker="Traçabilité"
        title={meta ? `${meta.total} action${meta.total > 1 ? 's' : ''}` : 'Journal'}
        actions={<LiveDot />}
      >
        <div className={layout.row}>
          <div style={{ flex: '1 1 260px' }}>
            <SearchInput label="Auteur, référence, action, IP… (touche /)" value={q} onChange={(e) => set('q', e.target.value)} />
          </div>
          <Select aria-label="Auteur" value={actor} onChange={(e) => set('actor', e.target.value)}>
            <option value="">Tous les auteurs</option>
            {actors
              .filter((person) => person.actor_id !== null)
              .map((person) => (
              <option key={person.actor_id} value={person.actor_id ?? ''}>
                {person.actor_name ?? 'Système'}
                {person.actor_role ? ` (${ROLE_LABEL[person.actor_role]})` : ''}
              </option>
            ))}
          </Select>
          <Select aria-label="Domaine" value={domain} onChange={(e) => set('domain', e.target.value)}>
            <option value="">Tous les domaines</option>
            {auditDomains().map((item) => (
              <option key={item}>{item}</option>
            ))}
          </Select>
          <Select aria-label="Action" value={action} onChange={(e) => set('action', e.target.value)}>
            <option value="">Toutes les actions</option>
            {ACTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <FilterChips<Period>
          label="Période"
          value={period}
          onChange={(value) => set('period', value === 'all' ? '' : value)}
          options={[
            { value: 'hour', label: '1 h' },
            { value: 'day', label: '24 h' },
            { value: 'week', label: '7 j' },
            { value: 'all', label: 'Tout' },
          ]}
        />
        {list.isLoading ? (
          <Skeleton lines={6} />
        ) : list.isError ? (
          <EmptyState title="Journal indisponible" icon="scroll">
            {messageFor(list.error)}{' '}
            <Button size="sm" onClick={() => void list.refetch()}>
              Réessayer
            </Button>
          </EmptyState>
        ) : (
          <>
            <AuditFeed logs={rows} live showIp />
            <AuditPager page={meta?.page ?? 1} pages={meta?.pages ?? 1} onPage={(next) => set('page', String(next))} />
          </>
        )}
      </Panel>
    </motion.div>
  )
}
