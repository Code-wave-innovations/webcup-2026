import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Link } from 'react-router'
import type { AuditChange, AuditEntry } from '../../api/types'
import { auditActionLabel, auditField, auditValue } from '../lib/labels'
import { formatDateTime, formatRelative } from '../lib/format'
import { useNow } from '../lib/useNow'
import { usePersona } from '../layout/persona'
import { Avatar, EmptyState } from '../ui/Feedback'
import { Button } from '../ui/Button'
import styles from './shared.module.css'

const META_LABEL: Record<string, string> = {
  note: 'Motif',
  notified: 'Personnes prévenues',
  count: 'Nombre',
  sent: 'Rappels envoyés',
  internal: 'Note interne',
  password_changed: 'Mot de passe',
  rows: 'Lignes exportées',
  stops: 'Arrêts',
  departures: 'Départs',
  cancelled: 'Rendez-vous annulés',
}

const toneOf = (role: string | null | undefined) => (role === 'ADMIN' ? 'ember' : role === 'CITIZEN' ? 'neutral' : 'ice')

const splitName = (name: string | null) => {
  const parts = (name ?? '').trim().split(/\s+/)
  return { name: parts[0] || '?', lastName: parts.slice(1).join(' ') }
}

function auditHref(entity: string, entityId: number | null, persona: 'ADMIN' | 'AGENT'): string | null {
  const base = persona === 'ADMIN' ? '/admin' : '/agent'
  if (entity === 'PlatformSetting') return '/admin/parametres'
  if (entityId === null) return null
  switch (entity) {
    case 'CitizenRequest':
      return `${base}/demandes/${entityId}`
    case 'CityService':
    case 'ServiceCategory':
    case 'Procedure':
      return '/admin/services'
    case 'User':
      return persona === 'ADMIN' ? '/admin/utilisateurs' : '/agent/citoyens'
    case 'Announcement':
      return '/admin/annonces'
    case 'Alert':
      return '/admin/alertes'
    case 'ServiceInterruption':
      return '/admin/maintenance'
    case 'Appointment':
    case 'AppointmentSlot':
      return persona === 'ADMIN' ? '/admin/rendez-vous' : '/agent/rendez-vous'
    default:
      return null
  }
}

const changeText = (change: AuditChange) => {
  if (change.masked) return <span className={styles.after}>{auditField(change.field)} modifié</span>
  const from = change.from ?? null
  const to = change.to ?? null
  return (
    <>
      <b>{auditField(change.field)}</b>
      {from !== null && from !== '' && <span className={styles.before}>{auditValue(from)}</span>}
      {from !== null && from !== '' && <span aria-hidden="true">→</span>}
      <span className={styles.after}>{to === null || to === '' ? '—' : auditValue(to)}</span>
    </>
  )
}

const metaLines = (metadata: Record<string, unknown> | null) => {
  if (!metadata) return []
  return Object.entries(metadata).flatMap(([key, value]) => {
    if (key === 'seed' || key === 'filters' || value === null || value === undefined) return []
    if (typeof value === 'object') return []
    const label = META_LABEL[key] ?? key
    const text = key === 'password_changed' ? 'modifié' : key === 'internal' ? (value ? 'oui' : 'non') : String(value)
    return [`${label} : ${text}`]
  })
}

/** F47 / F48: one line per action, with the before → after of each change. */
export function AuditFeed({ logs, live, showIp }: { logs: AuditEntry[]; live?: boolean; showIp?: boolean }) {
  const now = useNow()
  const persona = usePersona()
  const [openId, setOpenId] = useState<number | null>(null)
  const [flash, setFlash] = useState<Set<number>>(new Set())
  const maxSeen = useRef<number | null>(null)
  const flashTimer = useRef<number | null>(null)

  useEffect(() => {
    const highest = logs.reduce((max, log) => Math.max(max, log.id), 0)
    if (maxSeen.current === null) {
      maxSeen.current = highest
      return
    }
    const previous = maxSeen.current
    maxSeen.current = Math.max(maxSeen.current, highest)
    if (!live) return
    const fresh = logs.filter((log) => log.id > previous).map((log) => log.id)
    if (fresh.length === 0) return
    setFlash(new Set(fresh))
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => {
      flashTimer.current = null
      setFlash(new Set())
    }, 2400)
  }, [logs, live])

  useEffect(
    () => () => {
      if (flashTimer.current !== null) window.clearTimeout(flashTimer.current)
    },
    []
  )

  if (logs.length === 0) return <EmptyState title="Aucune action" icon="scroll">Rien ne correspond à ces filtres.</EmptyState>

  return (
    <ol className={styles.feed} aria-live={live ? 'polite' : undefined} aria-label="Journal des actions">
      <AnimatePresence initial={false}>
        {logs.map((log) => {
          const who = splitName(log.actor_name)
          const open = openId === log.id
          const href = auditHref(log.entity, log.entity_id, persona)
          const details = metaLines(log.metadata)
          return (
            <motion.li
              key={log.id}
              layout="position"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={[styles.feedItem, flash.has(log.id) && styles.flash].filter(Boolean).join(' ')}
            >
              <Avatar name={who.name} lastName={who.lastName} size={30} tone={toneOf(log.actor_role)} />
              <button
                type="button"
                className={[styles.sentence, styles.sentenceButton].join(' ')}
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : log.id)}
              >
                <strong>{log.actor_name ?? 'Système'}</strong> {auditActionLabel(log.action)} <em>{log.entity_label ?? log.entity}</em>
                {log.changes.length > 0 && (
                  <span className={styles.diff}>
                    {log.changes.map((change) => (
                      <span key={change.field} className={styles.change}>
                        {changeText(change)}
                      </span>
                    ))}
                  </span>
                )}
              </button>
              <span className={styles.when}>
                {formatRelative(log.created_at, now)}
                <small>{formatDateTime(log.created_at)}</small>
                {showIp && log.ip && <small>IP {log.ip}</small>}
              </span>
              {open && (
                <div className={styles.detail}>
                  {log.changes.length > 0 && (
                    <table className={styles.detailTable}>
                      <caption className="bo-sr-only">Valeurs avant et après</caption>
                      <thead>
                        <tr>
                          <th>Champ</th>
                          <th>Avant</th>
                          <th>Après</th>
                        </tr>
                      </thead>
                      <tbody>
                        {log.changes.map((change) => (
                          <tr key={change.field}>
                            <th scope="row">{auditField(change.field)}</th>
                            <td>{change.masked ? '—' : auditValue(change.from ?? null)}</td>
                            <td>{change.masked ? 'modifié' : auditValue(change.to ?? null)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {details.map((line) => (
                    <p key={line} className={styles.metaLine}>
                      {line}
                    </p>
                  ))}
                  {showIp && <p className={styles.metaLine}>Adresse IP : {log.ip ?? 'inconnue'}</p>}
                  {href && (
                    <p className={styles.metaLine}>
                      <Link to={href}>Ouvrir la fiche</Link>
                    </p>
                  )}
                </div>
              )}
            </motion.li>
          )
        })}
      </AnimatePresence>
    </ol>
  )
}

export function AuditPager({ page, pages, onPage }: { page: number; pages: number; onPage: (page: number) => void }) {
  if (pages <= 1) return null
  return (
    <div className={styles.pager}>
      <Button size="sm" icon="chevronLeft" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Précédent
      </Button>
      <span>
        {page} / {pages}
      </span>
      <Button size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Suivant
      </Button>
    </div>
  )
}
