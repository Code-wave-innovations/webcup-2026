import { useSearchParams } from 'react-router'
import { motion } from 'motion/react'
import { useAuditLogs } from '../../../api/audit'
import type { AuditFilters } from '../../../api/auditFilters'
import { messageFor } from '../../../api/errors'
import { useActor } from '../../layout/persona'
import { AUDIT_LABEL, auditDomains, entitiesForDomain } from '../../lib/labels'
import { AuditFeed, AuditPager } from '../../shared/AuditFeed'
import { Button } from '../../ui/Button'
import { FilterChips, Select } from '../../ui/Controls'
import { EmptyState, LiveDot, Skeleton } from '../../ui/Feedback'
import { PageHeader } from '../../ui/PageHeader'
import { Panel } from '../../ui/Panel'
import { StatTile } from '../../ui/StatTile'
import { stagger } from '../../ui/motion'
import layout from '../../ui/layout.module.css'

type Scope = 'mine' | 'team'
type Period = 'hour' | 'day' | 'week' | 'all'

/** F47 / F48: the agent's own actions, and the team's, without security rows or IP addresses. */
export default function ActivityPage() {
  const actor = useActor()
  const [params, setParams] = useSearchParams()
  const scope: Scope = params.get('scope') === 'mine' ? 'mine' : 'team'
  const agent = params.get('agent') ?? ''
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
    actor_id: scope === 'mine' ? actor.id : agent ? Number(agent) : undefined,
    entity: domain ? entitiesForDomain(domain) : undefined,
    action: action || undefined,
    period,
    page,
    limit: 25,
  }
  const list = useAuditLogs(filters, { live: true })
  const facets = useAuditLogs({ facets: true, limit: 1 }, { live: true })
  const mine = useAuditLogs({ actor_id: actor.id, limit: 1 }, { live: true })
  const team = useAuditLogs({ limit: 1 }, { live: true })
  const statuses = useAuditLogs({ action: 'request.status_changed', limit: 1 }, { live: true })

  const rows = list.data?.data ?? []
  const meta = list.data?.meta
  const authors = (facets.data?.actors ?? []).filter((person) => person.actor_id !== null && person.actor_role !== 'CITIZEN')

  return (
    <motion.div className={layout.page} variants={stagger} initial="hidden" animate="show">
      <PageHeader
        title="Activité & historique"
        codes={['F47', 'F48']}
        lead="Qui a modifié quoi, et quand. Chaque changement montre la valeur avant et après."
      />

      <motion.div className={layout.stats} variants={stagger}>
        <StatTile label="Mes actions" value={mine.data?.meta.total ?? 0} icon="user" tone="ice" />
        <StatTile label="Actions de l’équipe" value={team.data?.meta.total ?? 0} icon="users" tone="taken" />
        <StatTile label="Changements d’état" value={statuses.data?.meta.total ?? 0} icon="activity" tone="progress" />
      </motion.div>

      <Panel kicker="Journal" title={meta ? `${meta.total} action${meta.total > 1 ? 's' : ''}` : 'Historique des modifications'} actions={<LiveDot />}>
        <div className={layout.row}>
          <FilterChips<Scope>
            label="Auteur"
            value={scope}
            onChange={(value) => set('scope', value === 'team' ? '' : value)}
            options={[
              { value: 'team', label: 'Équipe' },
              { value: 'mine', label: 'Moi' },
            ]}
          />
          <Select aria-label="Agent" value={scope === 'mine' ? '' : agent} onChange={(e) => set('agent', e.target.value)} disabled={scope === 'mine'}>
            <option value="">Tous les agents</option>
            {authors.map((person) => (
              <option key={person.actor_id} value={person.actor_id ?? ''}>
                {person.actor_name}
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
            {Object.entries(AUDIT_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select aria-label="Période" value={period} onChange={(e) => set('period', e.target.value === 'all' ? '' : e.target.value)}>
            <option value="all">Toute la période</option>
            <option value="hour">Dernière heure</option>
            <option value="day">24 heures</option>
            <option value="week">7 jours</option>
          </Select>
        </div>
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
            <AuditFeed logs={rows} live />
            <AuditPager page={meta?.page ?? 1} pages={meta?.pages ?? 1} onPage={(next) => set('page', String(next))} />
          </>
        )}
      </Panel>
    </motion.div>
  )
}
