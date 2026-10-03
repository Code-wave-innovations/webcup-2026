import { useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { AuditLog } from '../mocks/types'
import { AUDIT_LABEL, auditValue } from '../lib/labels'
import { formatDateTime, formatRelative } from '../lib/format'
import { fullName, useUsersById } from '../lib/lookups'
import { useNow } from '../lib/useNow'
import { startLiveAudit, useAuditStore } from '../stores/auditStore'
import { Avatar, EmptyState } from '../ui/Feedback'
import styles from './shared.module.css'

const FIELD_LABEL: Record<string, string> = {
  status: 'état',
  priority: 'priorité',
  assigned_agent: 'agent',
  is_featured: 'mise en avant',
  is_active: 'actif',
  role: 'rôle',
  severity: 'gravité',
  audience: 'audience',
  impact: 'impact',
}

/** F47 / F48: who did what, when, with the before → after of each change. */
export function AuditFeed({ logs, live, showIp }: { logs: AuditLog[]; live?: boolean; showIp?: boolean }) {
  const users = useUsersById()
  const now = useNow()
  const latestId = useAuditStore((s) => s.latestId)

  useEffect(() => {
    if (!live) return
    return startLiveAudit()
  }, [live])

  if (logs.length === 0) return <EmptyState title="Aucune action" icon="scroll">Rien ne correspond à ces filtres.</EmptyState>

  return (
    <ol className={styles.feed} aria-live={live ? 'polite' : undefined} aria-label="Journal des actions">
      <AnimatePresence initial={false}>
        {logs.map((log) => {
          const actor = users.get(log.actor_id)
          return (
            <motion.li
              key={log.id}
              layout="position"
              initial={{ opacity: 0, y: -12, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0 }}
              className={[styles.feedItem, log.id === latestId && styles.flash].filter(Boolean).join(' ')}
            >
              <Avatar name={actor?.name ?? '?'} lastName={actor?.last_name} size={30} tone={actor?.role === 'ADMIN' ? 'ember' : actor?.role === 'CITIZEN' ? 'neutral' : 'ice'} />
              <div className={styles.sentence}>
                <strong>{fullName(actor)}</strong> {AUDIT_LABEL[log.action]} <em>{log.entity_label}</em>
                {log.changes.length > 0 && (
                  <div className={styles.diff}>
                    {log.changes.map((change) => (
                      <span key={change.field} className={styles.change}>
                        <b>{FIELD_LABEL[change.field] ?? change.field}</b>
                        {change.before !== null && <span className={styles.before}>{auditValue(change.before)}</span>}
                        {change.before !== null && <span aria-hidden="true">→</span>}
                        <span className={styles.after}>{auditValue(change.after)}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <span className={styles.when}>
                {formatRelative(log.at, now)}
                <small>{formatDateTime(log.at)}</small>
                {showIp && <small>IP {log.ip}</small>}
              </span>
            </motion.li>
          )
        })}
      </AnimatePresence>
    </ol>
  )
}
