import { useNavigate, useSearchParams } from 'react-router'
import { motion } from 'motion/react'
import { useDashboardStats } from '../../../api/dashboard'
import { useDistricts } from '../../../api/districts'
import { messageFor } from '../../../api/errors'
import { useRequests, useUpdateRequest } from '../../../api/requests'
import { useActor } from '../../layout/persona'
import { formatRelative } from '../../lib/format'
import { isOverdue } from '../../lib/thresholds'
import { useNow } from '../../lib/useNow'
import { DistrictMap } from '../../shared/DistrictMap'
import { toast } from '../../stores/toastStore'
import { PriorityTag, Ref, StatusPill, Tag } from '../../ui/Badges'
import { Button } from '../../ui/Button'
import { FilterChips } from '../../ui/Controls'
import { EmptyState, Skeleton } from '../../ui/Feedback'
import { Icon } from '../../ui/Icon'
import { PageHeader } from '../../ui/PageHeader'
import { Panel } from '../../ui/Panel'
import { StatTile } from '../../ui/StatTile'
import { stagger } from '../../ui/motion'
import layout from '../../ui/layout.module.css'
import styles from './reports.module.css'

/** F25: incident reports located on the city map, with one-click pick-up. The district lives in the URL. */
export default function ReportsPage() {
  const actor = useActor()
  const now = useNow()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const districtParam = Number(params.get('quartier'))
  const district = Number.isInteger(districtParam) && districtParam > 0 ? districtParam : null
  const districts = useDistricts().data ?? []
  const stats = useDashboardStats().data?.requests
  const update = useUpdateRequest()
  // Open reports, most urgent first, then the oldest
  // F95: without a district the list is the same as `all`: it is only asked for when a district is chosen
  const all = useRequests({ type: 'INCIDENT', scope: 'open', sort: 'priority', limit: 100 })
  const inDistrict = useRequests({ type: 'INCIDENT', scope: 'open', district_id: district ?? undefined, sort: 'priority', limit: 50 }, district !== null)
  const list = district === null ? all : inDistrict
  const resolved = useRequests({ type: 'INCIDENT', status: ['RESOLVED'], limit: 1 })

  const byDistrict = stats?.incidents_by_district ?? {}
  const counts = Object.fromEntries(districts.map((d) => [d.id, byDistrict[d.id] ?? 0]))
  const open = all.data?.data ?? []
  const critical = [...new Set(open.filter((r) => r.priority === 'URGENT' && r.district_id !== null).map((r) => r.district_id as number))]
  const setDistrict = (value: number | 'all') =>
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value === 'all') next.delete('quartier')
      else next.set('quartier', String(value))
      return next
    }, { replace: true })
  const districtName = districts.find((d) => d.id === district)?.name

  const takeOver = (id: number, reference: string) =>
    update.mutate(
      { id, assigned_agent_id: actor.id },
      { onSuccess: () => toast(`${reference} prise en charge : en examen, assignée à vous`), onError: (error) => toast(messageFor(error), 'alert') },
    )

  return (
    <motion.div className={layout.page} variants={stagger} initial="hidden" animate="show">
      <PageHeader
        title="Signalements citoyens"
        codes={['F25']}
        lead="Problèmes signalés sur l’espace public : où ils se trouvent, depuis quand, et qui s’en occupe."
      />

      <motion.div className={layout.stats} variants={stagger}>
        <StatTile label="Signalements ouverts" value={all.data?.meta.total ?? null} icon="pin" tone="ember" />
        <StatTile label="Urgents" value={all.data ? open.filter((r) => r.priority === 'URGENT').length : null} icon="alert" tone="alert" />
        <StatTile label="Sans agent" value={all.data ? open.filter((r) => !r.assigned_agent_id).length : null} icon="user" tone="progress" />
        <StatTile label="Résolus" value={resolved.data?.meta.total ?? null} icon="check" tone="ok" />
      </motion.div>

      <div className={[layout.grid, layout.split].join(' ')}>
        <Panel kicker="Carte de la ville" title="Signalements ouverts par quartier" accent={critical.length ? 'alert' : undefined}>
          {districts.length ? (
            <>
              <DistrictMap districts={districts} counts={counts} critical={critical} label="Nombre de signalements ouverts par quartier" />
              <FilterChips<number | 'all'>
                label="Quartier"
                value={district ?? 'all'}
                onChange={setDistrict}
                options={[
                  { value: 'all', label: 'Tous', count: all.data?.meta.total },
                  ...districts.map((d) => ({ value: d.id, label: d.name, count: counts[d.id] })),
                ]}
              />
            </>
          ) : (
            <Skeleton lines={5} />
          )}
        </Panel>

        <Panel kicker={districtName ?? 'Tous quartiers'} title={list.data ? `${list.data.meta.total} à traiter` : 'À traiter'} flush aria-busy={list.isFetching}>
          {!list.data ? (
            list.isError ? <EmptyState title={messageFor(list.error)} icon="alert" /> : <Skeleton lines={6} />
          ) : list.data.data.length === 0 ? (
            <EmptyState title="Aucun signalement ouvert" icon="check">
              {district ? 'Ce quartier est calme pour le moment.' : 'La ville est calme pour le moment.'}
            </EmptyState>
          ) : (
            <ul className={styles.list}>
              {list.data.data.map((r) => {
                const late = isOverdue(r, now)
                return (
                  <li key={r.id} className={r.priority === 'URGENT' ? styles.urgent : undefined}>
                    <div className={styles.head}>
                      <Ref>{r.reference}</Ref>
                      <StatusPill status={r.status} />
                    </div>
                    <p className={styles.subject}>{r.subject}</p>
                    <p className={styles.where}>
                      {r.location_label ?? 'Lieu non précisé'}
                      {r.district && ` · ${r.district.name}`} ·{' '}
                      <span style={{ color: late ? 'var(--color-progress)' : undefined }}>
                        {late && <Icon name="clock" size={12} label="En retard" />} {formatRelative(r.created_at, now)}
                      </span>
                      {r.attachment && (
                        <>
                          {' · '}
                          <Icon name="eye" size={12} /> photo
                        </>
                      )}
                    </p>
                    <div className={styles.actions}>
                      <PriorityTag priority={r.priority} />
                      {r.category && <Tag tone="neutral">{r.category}</Tag>}
                      {r.assigned_agent && <Tag tone="ice">{r.assigned_agent.name}</Tag>}
                      <span className={styles.spacer} />
                      {r.assigned_agent_id !== actor.id && (
                        <Button size="sm" variant="primary" icon="zap" disabled={update.isPending} onClick={() => takeOver(r.id, r.reference)}>
                          Prendre en charge
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/agent/demandes/${r.id}`)}>
                        Détail
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>
      </div>
    </motion.div>
  )
}
