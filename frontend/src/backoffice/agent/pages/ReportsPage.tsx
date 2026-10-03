import { useState } from 'react'
import { useNavigate } from 'react-router'
import { motion } from 'motion/react'
import { useActor } from '../../layout/persona'
import { NEEDS_ACTION, PRIORITY_RANK } from '../../lib/labels'
import { ageTone, formatRelative } from '../../lib/format'
import { districtName } from '../../lib/lookups'
import { useNow } from '../../lib/useNow'
import { DISTRICTS } from '../../mocks/people'
import { DistrictMap } from '../../shared/DistrictMap'
import { assignRequest, useRequestStore } from '../../stores/requestStore'
import { PriorityTag, Ref, StatusPill, Tag } from '../../ui/Badges'
import { Button } from '../../ui/Button'
import { FilterChips } from '../../ui/Controls'
import { EmptyState } from '../../ui/Feedback'
import { PageHeader } from '../../ui/PageHeader'
import { Panel } from '../../ui/Panel'
import { StatTile } from '../../ui/StatTile'
import { stagger } from '../../ui/motion'
import layout from '../../ui/layout.module.css'
import styles from './reports.module.css'

/** F25: incident reports located on the city map, with one-click pick-up. */
export default function ReportsPage() {
  const actor = useActor()
  const now = useNow()
  const navigate = useNavigate()
  const requests = useRequestStore((s) => s.requests)
  const [district, setDistrict] = useState<number | 'all'>('all')

  const incidents = requests.filter((r) => r.type === 'INCIDENT')
  const open = incidents.filter((r) => NEEDS_ACTION.includes(r.status) || r.status === 'WAITING_CITIZEN')
  const counts = Object.fromEntries(DISTRICTS.map((d) => [d.id, open.filter((r) => r.district_id === d.id).length]))
  const critical = [...new Set(open.filter((r) => r.priority === 'URGENT').map((r) => r.district_id).filter((d): d is number => d !== null))]
  const list = open
    .filter((r) => district === 'all' || r.district_id === district)
    .sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] || a.created_at.localeCompare(b.created_at))

  return (
    <motion.div className={layout.page} variants={stagger} initial="hidden" animate="show">
      <PageHeader simulated
        title="Signalements citoyens"
        codes={['F25']}
        lead="Problèmes signalés sur l’espace public : où ils se trouvent, depuis quand, et qui s’en occupe."
      />

      <motion.div className={layout.stats} variants={stagger}>
        <StatTile label="Signalements ouverts" value={open.length} icon="pin" tone="ember" />
        <StatTile label="Urgents" value={open.filter((r) => r.priority === 'URGENT').length} icon="alert" tone="alert" />
        <StatTile label="Sans agent" value={open.filter((r) => !r.assigned_agent_id).length} icon="user" tone="progress" />
        <StatTile label="Résolus" value={incidents.filter((r) => r.status === 'RESOLVED').length} icon="check" tone="ok" />
      </motion.div>

      <div className={[layout.grid, layout.split].join(' ')}>
        <Panel kicker="Carte de la ville" title="Signalements par quartier" accent={critical.length ? 'alert' : undefined}>
          <DistrictMap counts={counts} critical={critical} label="Nombre de signalements ouverts par quartier" />
          <FilterChips<number | 'all'>
            label="Quartier"
            value={district}
            onChange={setDistrict}
            options={[{ value: 'all', label: 'Tous', count: open.length }, ...DISTRICTS.map((d) => ({ value: d.id, label: d.name, count: counts[d.id] }))]}
          />
        </Panel>

        <Panel kicker={district === 'all' ? 'Tous quartiers' : districtName(district)} title={`${list.length} à traiter`} flush>
          {list.length === 0 ? (
            <EmptyState title="Aucun signalement ouvert" icon="check">
              Ce quartier est calme pour le moment.
            </EmptyState>
          ) : (
            <ul className={styles.list}>
              {list.map((r) => (
                <li key={r.id} className={r.priority === 'URGENT' ? styles.urgent : undefined}>
                  <div className={styles.head}>
                    <Ref>{r.reference}</Ref>
                    <StatusPill status={r.status} />
                  </div>
                  <p className={styles.subject}>{r.subject}</p>
                  <p className={styles.where}>
                    {r.location_label} · <span style={{ color: `var(--color-${ageTone(r.created_at, now)})` }}>{formatRelative(r.created_at, now)}</span>
                  </p>
                  <div className={styles.actions}>
                    <PriorityTag priority={r.priority} />
                    {r.category && <Tag tone="neutral">{r.category}</Tag>}
                    <span className={styles.spacer} />
                    {!r.assigned_agent_id && (
                      <Button size="sm" variant="primary" icon="zap" onClick={() => assignRequest(r.id, actor.id, actor.id)}>
                        Prendre en charge
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => navigate(`/agent/demandes/${r.id}`)}>
                      Détail
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </motion.div>
  )
}
