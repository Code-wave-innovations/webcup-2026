import { useAuditLogs } from '../../api/audit'
import { messageFor } from '../../api/errors'
import { useActor } from '../layout/persona'
import { EmptyState, Skeleton } from '../ui/Feedback'
import { AuditFeed } from './AuditFeed'

/** F48: every audited change of one object, newest first (« Historique » tab of the drawers). */
export function EntityHistory({ entity, entityId }: { entity: string; entityId: number }) {
  const admin = useActor().role === 'ADMIN'
  const history = useAuditLogs({ entity, entity_id: entityId, limit: 30 })
  if (history.isError) return <EmptyState title={messageFor(history.error)} icon="alert" />
  if (!history.data) return <Skeleton lines={4} />
  return <AuditFeed entries={history.data.data} showIp={admin} empty="Aucune modification enregistrée pour cet élément." />
}
