import { useState } from 'react'
import { motion } from 'motion/react'
import { useAuditLogs, type AuditFilters } from '../../../api/audit'
import { messageFor } from '../../../api/errors'
import { useActor } from '../../layout/persona'
import { ACTION_FAMILIES, ENTITIES } from '../../lib/auditText'
import { PERIODS, periodFrom, type Period } from '../../lib/periods'
import { useNow } from '../../lib/useNow'
import { AuditFeed } from '../../shared/AuditFeed'
import { Button } from '../../ui/Button'
import { FilterChips, Select, Tabs } from '../../ui/Controls'
import { EmptyState, LiveDot, Skeleton } from '../../ui/Feedback'
import { PageHeader } from '../../ui/PageHeader'
import { Panel } from '../../ui/Panel'
import { StatTile } from '../../ui/StatTile'
import { stagger } from '../../ui/motion'
import layout from '../../ui/layout.module.css'

const PAGE_SIZE = 25

/** F47 / F48: what the team did, with the before → after of each change (no security entry nor IP for agents). */
export default function ActivityPage() {
  const actor = useActor()
  const now = useNow()
  const [tab, setTab] = useState<'mine' | 'team'>('mine')
  const [entity, setEntity] = useState('')
  const [action, setAction] = useState('')
  const [period, setPeriod] = useState<Period>('semaine')
  const [limit, setLimit] = useState(PAGE_SIZE)

  const from = periodFrom(period, now)
  const filters: AuditFilters = {
    actor_id: tab === 'mine' ? actor.id : undefined,
    entity: entity || undefined,
    action: action || undefined,
    from,
    limit,
  }
  const list = useAuditLogs(filters, { live: true })
  // counters over the same period
  const mine = useAuditLogs({ actor_id: actor.id, from, limit: 1 })
  const team = useAuditLogs({ from, limit: 1 })
  const statuses = useAuditLogs({ action: 'request.status_changed', from, limit: 1 })
  const total = list.data?.meta.total ?? 0

  return (
    <motion.div className={layout.page} variants={stagger} initial="hidden" animate="show">
      <PageHeader title="Activité & historique" lead="Qui a modifié quoi, et quand. Chaque changement montre la valeur avant et après ; un clic ouvre le détail." />

      <motion.div className={layout.stats} variants={stagger}>
        <StatTile label="Mes actions" value={mine.data?.meta.total ?? null} icon="user" tone="ice" hint={PERIODS.find((p) => p.value === period)?.label} />
        <StatTile label="Actions de l’équipe" value={team.data?.meta.total ?? null} icon="users" tone="taken" />
        <StatTile label="Changements d’état" value={statuses.data?.meta.total ?? null} icon="activity" tone="progress" />
      </motion.div>

      <Panel kicker="Journal" title="Historique des modifications" actions={<LiveDot />} aria-busy={list.isFetching}>
        <Tabs<'mine' | 'team'>
          label="Auteur"
          idPrefix="activity"
          value={tab}
          onChange={(value) => {
            setTab(value)
            setLimit(PAGE_SIZE)
          }}
          tabs={[
            { value: 'mine', label: 'Mes actions', count: mine.data?.meta.total },
            { value: 'team', label: 'Équipe', count: team.data?.meta.total },
          ]}
        />
        <div id="activity-panel" role="tabpanel" aria-labelledby={`activity-tab-${tab}`} className={layout.stack}>
          <div className={layout.row}>
            <Select aria-label="Objet" value={entity} onChange={(e) => setEntity(e.target.value)}>
              <option value="">Tous les objets</option>
              {ENTITIES.map((e) => (
                <option key={e.value} value={e.value}>
                  {e.label}
                </option>
              ))}
            </Select>
            <Select aria-label="Action" value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="">Toutes les actions</option>
              {ACTION_FAMILIES.filter((f) => f.value !== 'security.' && f.value !== 'auth.').map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </Select>
            <FilterChips<Period> label="Période" value={period} onChange={setPeriod} options={PERIODS.map((p) => ({ value: p.value, label: p.label }))} />
          </div>
          {list.data ? (
            <>
              <AuditFeed entries={list.data.data} live />
              {total > list.data.data.length && (
                <Button variant="ghost" onClick={() => setLimit((current) => Math.min(100, current + PAGE_SIZE))} disabled={limit >= 100}>
                  Afficher plus ({list.data.data.length} sur {total})
                </Button>
              )}
            </>
          ) : list.isError ? (
            <EmptyState title={messageFor(list.error)} icon="alert" />
          ) : (
            <Skeleton lines={6} />
          )}
        </div>
      </Panel>
    </motion.div>
  )
}
