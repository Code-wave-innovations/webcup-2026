import { useNavigate } from 'react-router'
import type { CitizenRequest } from '../mocks/types'
import { PRIORITY_RANK, TYPE_LABEL } from '../lib/labels'
import { ageTone, formatRelative } from '../lib/format'
import { fullName, useServiceName, useUsersById } from '../lib/lookups'
import { useNow } from '../lib/useNow'
import { usePersona } from '../layout/persona'
import { DataTable, type Column } from '../ui/DataTable'
import { PriorityTag, Ref, StatusPill } from '../ui/Badges'
import { Avatar } from '../ui/Feedback'
import styles from './shared.module.css'

const AGE_COLOR = { ok: 'var(--color-ok)', progress: 'var(--color-progress)', alert: 'var(--color-alert)' }

/** F22: request queue, shared by the agent list, the dashboard and the admin supervision. */
export function RequestTable({ requests, caption, compact }: { requests: CitizenRequest[]; caption: string; compact?: boolean }) {
  const navigate = useNavigate()
  const persona = usePersona()
  const now = useNow()
  const users = useUsersById()
  const serviceName = useServiceName()
  const base = persona === 'ADMIN' ? '/admin' : '/agent'

  const columns: Column<CitizenRequest>[] = [
    // compact (side panels): the reference moves under the subject to save width
    ...(compact ? [] : [{ key: 'ref', header: 'Référence', cell: (r: CitizenRequest) => <Ref>{r.reference}</Ref>, sortValue: (r: CitizenRequest) => r.reference, width: '150px' }]),
    {
      key: 'subject',
      header: 'Demande',
      sortValue: (r) => r.subject,
      cell: (r) => (
        <span className={styles.subject}>
          <strong>{r.subject}</strong>
          <small>
            {compact && `${r.reference} · `}
            {TYPE_LABEL[r.type]} · {r.citizen_id ? fullName(users.get(r.citizen_id)) : (r.contact_name ?? 'Visiteur')}
          </small>
        </span>
      ),
    },
    { key: 'status', header: 'État', cell: (r) => <StatusPill status={r.status} />, sortValue: (r) => r.status },
    { key: 'priority', header: 'Priorité', cell: (r) => <PriorityTag priority={r.priority} />, sortValue: (r) => PRIORITY_RANK[r.priority] },
    {
      key: 'age',
      header: 'Reçue',
      sortValue: (r) => -new Date(r.created_at).getTime(),
      cell: (r) => (
        <span className={styles.age} style={{ color: r.resolved_at ? 'var(--color-text-muted)' : AGE_COLOR[ageTone(r.created_at, now)] }}>
          {formatRelative(r.created_at, now)}
        </span>
      ),
    },
    ...(compact
      ? []
      : [
          {
            key: 'agent',
            header: 'Assignée à',
            hideOnPhone: true,
            sortValue: (r: CitizenRequest) => fullName(users.get(r.assigned_agent_id ?? -1)),
            cell: (r: CitizenRequest) => {
              const agent = r.assigned_agent_id ? users.get(r.assigned_agent_id) : undefined
              return agent ? (
                <span className={styles.person}>
                  <Avatar name={agent.name} lastName={agent.last_name} size={24} />
                  {agent.name}
                </span>
              ) : (
                <span className={styles.unassigned}>Non assignée</span>
              )
            },
          },
          { key: 'service', header: 'Service', hideOnPhone: true, cell: (r: CitizenRequest) => <span className={styles.muted}>{serviceName(r.service_id)}</span> },
        ]),
  ]

  return (
    <DataTable
      caption={caption}
      columns={columns}
      rows={requests}
      rowKey={(r) => r.id}
      onRowClick={(r) => navigate(`${base}/demandes/${r.id}`)}
      rowTone={(r) => (r.priority === 'URGENT' && !r.resolved_at ? 'alert' : r.status === 'SUBMITTED' ? 'ember' : undefined)}
      empty="Aucune demande ne correspond à ces filtres."
    />
  )
}
