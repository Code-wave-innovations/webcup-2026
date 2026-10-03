import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import type { RequestListItem } from '../../api/types'
import { PRIORITY_RANK, TYPE_LABEL } from '../lib/labels'
import { formatRelative } from '../lib/format'
import { fullName } from '../lib/lookups'
import { requesterLabel } from '../lib/requests'
import { isOverdue } from '../lib/thresholds'
import { useNow } from '../lib/useNow'
import { usePersona } from '../layout/persona'
import { DataTable, type Column } from '../ui/DataTable'
import { PriorityTag, Ref, StatusPill } from '../ui/Badges'
import { Avatar } from '../ui/Feedback'
import { Icon } from '../ui/Icon'
import styles from './shared.module.css'

interface RequestTableProps {
  requests: RequestListItem[]
  caption: string
  compact?: boolean
  /** Extra column at the end (e.g. a selection checkbox in the supervision) */
  lead?: { header: string; cell: (r: RequestListItem) => ReactNode }
}

/** F22: request queue, shared by the agent list, the citizen record and the admin supervision. */
export function RequestTable({ requests, caption, compact, lead }: RequestTableProps) {
  const navigate = useNavigate()
  const persona = usePersona()
  const now = useNow()
  const base = persona === 'ADMIN' ? '/admin' : '/agent'

  const columns: Column<RequestListItem>[] = [
    ...(lead ? [{ key: 'lead', header: lead.header, cell: lead.cell, width: '44px' }] : []),
    // compact (side panels): the reference moves under the subject to save width
    ...(compact ? [] : [{ key: 'ref', header: 'Référence', cell: (r: RequestListItem) => <Ref>{r.reference}</Ref>, sortValue: (r: RequestListItem) => r.reference, width: '150px' }]),
    {
      key: 'subject',
      header: 'Demande',
      sortValue: (r) => r.subject,
      cell: (r) => (
        <span className={styles.subject}>
          <strong>{r.subject}</strong>
          <small>
            {compact && `${r.reference} · `}
            {TYPE_LABEL[r.type]} · {requesterLabel(r)}
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
      cell: (r) => {
        const late = isOverdue(r, now)
        return (
          <span className={styles.age} style={{ color: r.resolved_at ? 'var(--color-text-muted)' : late ? 'var(--color-progress)' : undefined }}>
            {late && <Icon name="clock" size={13} label="En retard" />} {formatRelative(r.created_at, now)}
          </span>
        )
      },
    },
    ...(compact
      ? []
      : [
          {
            key: 'agent',
            header: 'Assignée à',
            hideOnPhone: true,
            sortValue: (r: RequestListItem) => fullName(r.assigned_agent ?? undefined),
            cell: (r: RequestListItem) =>
              r.assigned_agent ? (
                <span className={styles.person}>
                  <Avatar name={r.assigned_agent.name} lastName={r.assigned_agent.last_name} size={24} />
                  {r.assigned_agent.name}
                </span>
              ) : (
                <span className={styles.unassigned}>Non assignée</span>
              ),
          },
          { key: 'service', header: 'Service', hideOnPhone: true, cell: (r: RequestListItem) => <span className={styles.muted}>{r.service?.name ?? '—'}</span> },
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
