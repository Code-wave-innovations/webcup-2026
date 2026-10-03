import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { flatNav } from '../nav'
import type { Persona } from '../mocks/types'
import { ALL_USERS } from '../mocks/people'
import { AUDIT_LABEL, ROLE_LABEL } from '../lib/labels'
import { formatRelative } from '../lib/format'
import { useNow } from '../lib/useNow'
import { useAuditStore } from '../stores/auditStore'
import { useRequestStore } from '../stores/requestStore'
import { Icon } from '../ui/Icon'
import { Avatar, Kbd } from '../ui/Feedback'
import { PERSONA_USER } from './persona'
import { useBadges } from './useBadges'
import styles from './Shell.module.css'

const clockFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

function Breadcrumbs({ persona }: { persona: Persona }) {
  const { pathname } = useLocation()
  const requests = useRequestStore((s) => s.requests)
  const items = flatNav(persona)
  const root = items[0]
  const section = [...items].sort((a, b) => b.path.length - a.path.length).find((i) => i !== root && pathname.startsWith(i.path))
  const rest = section ? pathname.slice(section.path.length).split('/').filter(Boolean) : []
  const detail = rest[0] && section?.path.endsWith('/demandes') ? requests.find((r) => String(r.id) === rest[0])?.reference : rest[0]

  const crumbs = [
    { label: persona === 'ADMIN' ? 'Administration' : 'Espace agent', to: root.path },
    ...(section ? [{ label: section.label, to: section.path }] : []),
    ...(detail ? [{ label: detail, to: pathname }] : []),
  ]
  return (
    <nav aria-label="Fil d’Ariane" className={styles.crumbs}>
      <ol>
        {crumbs.map((crumb, i) => {
          const last = i === crumbs.length - 1
          return (
            <li key={crumb.to}>
              {last ? <span aria-current="page">{crumb.label}</span> : <Link to={crumb.to}>{crumb.label}</Link>}
              {!last && <Icon name="chevronRight" size={13} />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])
  return ref
}

interface TopbarProps {
  persona: Persona
  onOpenMenu: () => void
  onOpenPalette: () => void
}

export function Topbar({ persona, onOpenMenu, onOpenPalette }: TopbarProps) {
  const now = useNow()
  const navigate = useNavigate()
  const badges = useBadges()
  const logs = useAuditStore((s) => s.logs)
  const [panel, setPanel] = useState<'bell' | 'profile' | null>(null)
  const close = () => setPanel(null)
  const bellRef = useDismiss(panel === 'bell', close)
  const profileRef = useDismiss(panel === 'profile', close)
  const user = PERSONA_USER[persona]
  const disruptions = badges.activeAlerts + badges.interruptions
  const recent = logs.slice(0, 6)

  return (
    <header className={styles.topbar}>
      <button type="button" className={styles.menuButton} onClick={onOpenMenu} aria-controls="bo-sidebar" aria-label="Ouvrir le menu">
        <Icon name="menu" size={20} />
      </button>

      <Breadcrumbs persona={persona} />

      <div className={styles.topActions}>
        <button type="button" className={styles.command} onClick={onOpenPalette} aria-label="Ouvrir la palette de commandes">
          <Icon name="search" size={16} />
          <span className={styles.commandText}>Rechercher, aller à…</span>
          <span className={styles.commandKeys} aria-hidden="true">
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>

        <span className={[styles.status, disruptions > 0 ? styles.statusWarn : styles.statusOk].join(' ')}>
          <span className={styles.statusDot} aria-hidden="true" />
          <span className={styles.statusText}>{disruptions > 0 ? `${disruptions} perturbation${disruptions > 1 ? 's' : ''}` : 'Systèmes nominaux'}</span>
        </span>

        <time className={styles.clock} dateTime={new Date(now).toISOString()}>
          {clockFormat.format(now)}
        </time>

        <span className={styles.demoChip} title="Aucun appel API : interface de démonstration">
          Démo
        </span>

        <div className={styles.popWrap} ref={bellRef}>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Activité récente"
            aria-expanded={panel === 'bell'}
            onClick={() => setPanel(panel === 'bell' ? null : 'bell')}
          >
            <Icon name="bell" size={19} />
            <span className={styles.bellDot} aria-hidden="true" />
          </button>
          <AnimatePresence>
            {panel === 'bell' && (
              <motion.div
                className={styles.popover}
                initial={{ opacity: 0, y: -8, scaleY: 0.9 }}
                animate={{ opacity: 1, y: 0, scaleY: 1 }}
                exit={{ opacity: 0, y: -6 }}
                style={{ originY: 0 }}
              >
                <p className={styles.popTitle}>Activité récente</p>
                <ul className={styles.popList}>
                  {recent.map((log) => {
                    const actor = ALL_USERS.find((u) => u.id === log.actor_id)
                    return (
                      <li key={log.id}>
                        <strong>{actor ? `${actor.name} ${actor.last_name}` : 'Système'}</strong> {AUDIT_LABEL[log.action]} <em>{log.entity_label}</em>
                        <small>{formatRelative(log.at, now)}</small>
                      </li>
                    )
                  })}
                </ul>
                <Link className={styles.popLink} to={persona === 'ADMIN' ? '/admin/audit' : '/agent/activite'} onClick={close}>
                  Tout l’historique <Icon name="chevronRight" size={14} />
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className={styles.popWrap} ref={profileRef}>
          <button
            type="button"
            className={styles.profile}
            aria-expanded={panel === 'profile'}
            aria-label={`Profil : ${user.name} ${user.last_name}`}
            onClick={() => setPanel(panel === 'profile' ? null : 'profile')}
          >
            <Avatar name={user.name} lastName={user.last_name} size={32} tone={persona === 'ADMIN' ? 'ember' : 'ice'} />
            <span className={styles.profileText}>
              {user.name} {user.last_name}
              <small>{ROLE_LABEL[user.role]}</small>
            </span>
            <Icon name="chevronDown" size={14} />
          </button>
          <AnimatePresence>
            {panel === 'profile' && (
              <motion.div
                className={[styles.popover, styles.popSmall].join(' ')}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
              >
                <p className={styles.popTitle}>Persona de démonstration</p>
                {(['AGENT', 'ADMIN'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={styles.popItem}
                    aria-pressed={p === persona}
                    onClick={() => {
                      close()
                      navigate(p === 'ADMIN' ? '/admin' : '/agent')
                    }}
                  >
                    <Icon name={p === 'ADMIN' ? 'key' : 'user'} size={16} />
                    {PERSONA_USER[p].name} — {p === 'ADMIN' ? 'Administratrice' : 'Agent'}
                    {p === persona && <Icon name="check" size={16} />}
                  </button>
                ))}
                <hr className={styles.popRule} />
                <Link className={styles.popItem} to="/" onClick={close}>
                  <Icon name="logout" size={16} />
                  Retour au site citoyen
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  )
}
