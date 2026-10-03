import { messageFor } from '../../api/errors'
import { useAuditLogs } from '../../api/audit'
import { useRecordId } from '../../api/recordId'
import { usePersona } from '../layout/persona'
import { Button } from '../ui/Button'
import { EmptyState, Skeleton } from '../ui/Feedback'
import { AuditFeed } from './AuditFeed'

/** F48: the journal of one record, shared by the drawers that edit it. */
export function EntityHistory({ entity, entityId }: { entity: string; entityId: number }) {
  const persona = usePersona()
  const query = useAuditLogs({ entity: [entity], entity_id: entityId, limit: 20 })

  if (query.isLoading) return <Skeleton lines={4} />
  if (query.isError) {
    return (
      <EmptyState title="Historique indisponible" icon="scroll">
        {messageFor(query.error)}{' '}
        <Button size="sm" onClick={() => void query.refetch()}>
          Réessayer
        </Button>
      </EmptyState>
    )
  }

  return <AuditFeed logs={query.data?.data ?? []} showIp={persona === 'ADMIN'} />
}

/** The live strip on the dashboards: the eight latest real entries, refreshed every 15 s. */
export function LiveAuditFeed({ limit = 8, showIp = false }: { limit?: number; showIp?: boolean }) {
  const query = useAuditLogs({ limit }, { live: true })

  if (query.isLoading) return <Skeleton lines={4} />
  if (query.isError) {
    return (
      <EmptyState title="Journal indisponible" icon="scroll">
        {messageFor(query.error)}
      </EmptyState>
    )
  }

  return <AuditFeed logs={query.data?.data ?? []} live showIp={showIp} />
}

/** History of a record found by slug, email or reference, not by the local mock id. */
export function LinkedHistory({
  entity,
  match,
}: {
  entity: 'CityService' | 'User' | 'CitizenRequest'
  match: string
}) {
  const id = useRecordId(entity, match)

  if (id.isLoading) return <Skeleton lines={4} />
  if (id.isError) {
    return (
      <EmptyState title="Historique indisponible" icon="scroll">
        {messageFor(id.error)}{' '}
        <Button size="sm" onClick={() => void id.refetch()}>
          Réessayer
        </Button>
      </EmptyState>
    )
  }
  if (id.data == null) {
    return <EmptyState title="Aucune modification" icon="scroll">Rien n’a encore été enregistré pour cette fiche.</EmptyState>
  }

  return <EntityHistory entity={entity} entityId={id.data} />
}
