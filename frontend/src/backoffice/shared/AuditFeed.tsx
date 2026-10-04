import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import type { AuditEntry } from '../../api/types'
import { usePersona } from '../layout/persona'
import { actionText, auditField, auditValue, changeText, entityLink, shortName } from '../lib/auditText'
import { formatDateTime, formatRelative } from '../lib/format'
import { ROLE_LABEL } from '../lib/labels'
import { useNow } from '../lib/useNow'
import { Avatar, EmptyState } from '../ui/Feedback'
import { Drawer } from '../ui/Overlay'
import layout from '../ui/layout.module.css'
import styles from './shared.module.css'

const FLASH_MS = 2400

/** F47 / F48: who did what, when, on what — one line per action, the detail on click. */
export function AuditFeed({ entries, showIp, live, empty = 'Aucune action ne correspond à ces filtres.' }: { entries: AuditEntry[]; showIp?: boolean; live?: boolean; empty?: string }) {
  const now = useNow()
  const persona = usePersona()
  const base = persona === 'ADMIN' ? '/admin' : '/agent'
  const [open, setOpen] = useState<AuditEntry | null>(null)

  // Entries newer than the ones already shown light up briefly
  const newest = entries.reduce((max, entry) => Math.max(max, entry.id), 0)
  const [seen, setSeen] = useState(newest)
  useEffect(() => {
    if (!live || newest <= seen) return
    const timer = setTimeout(() => setSeen(newest), FLASH_MS)
    return () => clearTimeout(timer)
  }, [live, newest, seen])

  if (entries.length === 0) return <EmptyState title="Aucune action" icon="scroll">{empty}</EmptyState>

  return (
    <>
      <ol className={styles.feed} aria-live={live ? 'polite' : undefined} aria-label="Journal des actions">
        {entries.map((entry) => {
          const changes = entry.changes ?? []
          return (
            <li key={entry.id} className={[styles.feedItem, live && entry.id > seen && styles.flash].filter(Boolean).join(' ')}>
              <Avatar
                name={entry.actor_name ?? 'Système'}
                size={30}
                tone={entry.actor_role === 'ADMIN' ? 'ember' : entry.actor_role === 'AGENT' ? 'ice' : 'neutral'}
              />
              <button type="button" className={styles.feedButton} onClick={() => setOpen(entry)}>
                <span className={styles.sentence}>
                  {entry.actor_name !== null && <strong>{shortName(entry.actor_name)} </strong>}
                  {actionText(entry.action)} {entry.entity_label && <em>{entry.entity_label}</em>}
                  {changes.length > 0 && (
                    <span className={styles.diff}>
                      {changes.slice(0, 3).map((change) => (
                        <span key={change.field} className={styles.change}>
                          {changeText(change)}
                        </span>
                      ))}
                      {changes.length > 3 && <span className={styles.change}>+{changes.length - 3}</span>}
                    </span>
                  )}
                </span>
              </button>
              <span className={styles.when}>
                {formatRelative(entry.created_at, now)}
                <small>{formatDateTime(entry.created_at)}</small>
                {showIp && entry.ip && <small>IP {entry.ip}</small>}
              </span>
            </li>
          )
        })}
      </ol>

      <Drawer open={open !== null} onClose={() => setOpen(null)} title={open ? `${actionText(open.action)}${open.entity_label ? ` ${open.entity_label}` : ''}` : ''} kicker="F48 · Détail de l’action">
        {open && <AuditDetail entry={open} showIp={showIp} link={entityLink(open, base)} />}
      </Drawer>
    </>
  )
}

function AuditDetail({ entry, showIp, link }: { entry: AuditEntry; showIp?: boolean; link: string | null }) {
  const changes = entry.changes ?? []
  const metadata = Object.entries(entry.metadata ?? {})
  return (
    <div className={layout.stack}>
      <dl className={layout.dl}>
        <dt>Qui</dt>
        <dd>{entry.actor_name ? `${entry.actor_name}${entry.actor_role ? ` (${ROLE_LABEL[entry.actor_role]})` : ''}` : 'Système'}</dd>
        <dt>Quand</dt>
        <dd>{formatDateTime(entry.created_at)}</dd>
        <dt>Action</dt>
        <dd>
          <code>{entry.action}</code>
        </dd>
        <dt>Objet</dt>
        <dd>
          {entry.entity}
          {entry.entity_id !== null && ` #${entry.entity_id}`}
          {entry.entity_label && ` · ${entry.entity_label}`}
        </dd>
        {showIp && (
          <>
            <dt>Adresse IP</dt>
            <dd>{entry.ip ?? 'inconnue'}</dd>
          </>
        )}
      </dl>

      {changes.length > 0 && (
        <table className={styles.auditTable}>
          <caption className="bo-sr-only">Valeurs avant et après</caption>
          <thead>
            <tr>
              <th scope="col">Champ</th>
              <th scope="col">Avant</th>
              <th scope="col">Après</th>
            </tr>
          </thead>
          <tbody>
            {changes.map((change) => (
              <tr key={change.field}>
                <th scope="row">{auditField(change.field)}</th>
                {'masked' in change ? (
                  <td colSpan={2}>Modifié (donnée personnelle, non copiée dans le journal)</td>
                ) : (
                  <>
                    <td className={styles.before}>{auditValue(change.from)}</td>
                    <td className={styles.after}>{auditValue(change.to)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {metadata.length > 0 && (
        <>
          <p className={layout.sectionLabel}>Détails</p>
          <dl className={layout.dl}>
            {metadata.map(([key, value]) => (
              <div key={key} style={{ display: 'contents' }}>
                <dt>{key === 'demo' ? 'Donnée de démonstration' : auditField(key)}</dt>
                <dd>{auditValue(value)}</dd>
              </div>
            ))}
          </dl>
        </>
      )}

      {link && <Link to={link}>Ouvrir l’objet</Link>}
      <p className={layout.sectionLabel}>Une entrée du journal ne peut être ni modifiée ni supprimée (F47).</p>
    </div>
  )
}
