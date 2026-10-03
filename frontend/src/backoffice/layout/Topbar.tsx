import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { messageFor } from '../../api/errors'
import { useMarkAllRead, useMarkRead, useNotifications, useUnreadCount } from '../../api/notifications'
import { useRequest } from '../../api/requests'
import { signOut } from '../../api/session'
import type { AppNotification } from '../../api/types'
import { flatNav } from '../nav'
import type { Persona } from '../mocks/types'
import { ROLE_LABEL } from '../lib/labels'
import { formatRelative } from '../lib/format'
import { useNow } from '../lib/useNow'
import { toast } from '../stores/toastStore'
import { Icon } from '../ui/Icon'
import { Avatar, Kbd } from '../ui/Feedback'
import { homePath, useActor } from './persona'
import { useBadges } from './useBadges'
import styles from './Shell.module.css'

const clockFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

function Breadcrumbs({ persona }: { persona: Persona }) {
  const { pathname } = useLocation()
  const items = flatNav(persona)
  const root = items[0]
  const section = [...items].sort((a, b) => b.path.length - a.path.length).find((i) => i !== root && pathname.startsWith(i.path))
  const rest = section ? pathname.slice(section.path.length).split('/').filter(Boolean) : []
  const requestId = rest[0] && section?.path.endsWith('/demandes') ? Number(rest[0]) : undefined
  // same query as the detail page: no extra request
  const request = useRequest(requestId).data
  const detail = requestId !== undefined ? (request?.reference ?? '…') : rest[0]

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

/** Notification links point to the citizen space; the staff open the matching screen when there is one. */
function staffLink(link: string | null, persona: Persona): string | null {
  const request = link?.match(/^\/requests\/(\d+)/)
  if (request) return `${homePath(persona)}/demandes/${request[1]}`
  if (link?.startsWith('/appointments')) return `${homePath(persona)}/rendez-vous`
  return null
}

/** The signed-in account's latest notifications, fetched while the panel is open. */
function NotificationList({ persona, unread, now, onClose }: { persona: Persona; unread: number; now: number; onClose: () => void }) {
  const navigate = useNavigate()
  const notifications = useNotifications(8)
  const markRead = useMarkRead()
  const markAllRead = useMarkAllRead()

  const open = (notification: AppNotification) => {
    if (!notification.read_at) markRead.mutate(notification.id)
    const to = staffLink(notification.link, persona)
    if (to) {
      onClose()
      navigate(to)
    }
  }

  return (
    <>
      <div className={styles.popHead}>
        <p className={styles.popTitle}>Notifications</p>
        {unread > 0 && (
          <button
            type="button"
            className={styles.popAction}
            disabled={markAllRead.isPending}
            onClick={() => markAllRead.mutate(undefined, { onError: (error) => toast(messageFor(error), 'alert') })}
          >
            Tout marquer comme lu
          </button>
        )}
      </div>
      {notifications.isPending ? (
        <p className={styles.popEmpty}>Chargement…</p>
      ) : notifications.isError ? (
        <p className={styles.popEmpty}>{messageFor(notifications.error)}</p>
      ) : notifications.data.data.length === 0 ? (
        <p className={styles.popEmpty}>Aucune notification pour le moment.</p>
      ) : (
        <ul className={styles.popList}>
          {notifications.data.data.map((notification) => (
            <li key={notification.id}>
              <button type="button" className={styles.notif} data-unread={!notification.read_at || undefined} onClick={() => open(notification)}>
                <strong>{notification.title}</strong>
                {notification.body && <span className={styles.notifBody}>{notification.body}</span>}
                <small>
                  {!notification.read_at && 'Non lue · '}
                  {formatRelative(notification.created_at, now)}
                </small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
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
  const unreadCount = useUnreadCount()
  const user = useActor()
  const [panel, setPanel] = useState<'bell' | 'profile' | null>(null)
  const close = () => setPanel(null)
  const bellRef = useDismiss(panel === 'bell', close)
  const profileRef = useDismiss(panel === 'profile', close)
  const unread = unreadCount.data ?? 0
  const known = badges.activeAlerts !== undefined && badges.interruptions !== undefined
  const disruptions = (badges.activeAlerts ?? 0) + (badges.interruptions ?? 0)

  // RequireStaff then shows the login page, which returns here after the next sign-in
  const signOutNow = () => {
    close()
    signOut()
    toast('Vous êtes déconnecté·e.', 'info')
  }

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

        {known && (
          <span className={[styles.status, disruptions > 0 ? styles.statusWarn : styles.statusOk].join(' ')}>
            <span className={styles.statusDot} aria-hidden="true" />
            <span className={styles.statusText}>{disruptions > 0 ? `${disruptions} perturbation${disruptions > 1 ? 's' : ''}` : 'Systèmes nominaux'}</span>
          </span>
        )}

        <time className={styles.clock} dateTime={new Date(now).toISOString()}>
          {clockFormat.format(now)}
        </time>

        <div className={styles.popWrap} ref={bellRef}>
          <button
            type="button"
            className={styles.iconButton}
            aria-label={unread > 0 ? `Notifications : ${unread} non lue${unread > 1 ? 's' : ''}` : 'Notifications'}
            aria-expanded={panel === 'bell'}
            onClick={() => setPanel(panel === 'bell' ? null : 'bell')}
          >
            <Icon name="bell" size={19} />
            {unread > 0 && (
              <span className={styles.bellCount} aria-hidden="true">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
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
                <NotificationList persona={persona} unread={unread} now={now} onClose={close} />
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
            <Avatar name={user.name} lastName={user.last_name} size={32} tone={user.role === 'ADMIN' ? 'ember' : 'ice'} />
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
                <p className={styles.popTitle}>Mon compte</p>
                <p className={styles.popIdentity}>
                  <strong>
                    {user.name} {user.last_name}
                  </strong>
                  <small>{user.email}</small>
                  <small>{ROLE_LABEL[user.role]}</small>
                </p>
                {user.role === 'ADMIN' && (
                  <>
                    <hr className={styles.popRule} />
                    <p className={styles.popTitle}>Vue</p>
                    {(['ADMIN', 'AGENT'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={styles.popItem}
                        aria-pressed={p === persona}
                        onClick={() => {
                          close()
                          navigate(homePath(p))
                        }}
                      >
                        <Icon name={p === 'ADMIN' ? 'key' : 'user'} size={16} />
                        {p === 'ADMIN' ? 'Vue administration' : 'Vue agent'}
                        {p === persona && <Icon name="check" size={16} />}
                      </button>
                    ))}
                  </>
                )}
                <hr className={styles.popRule} />
                <Link className={styles.popItem} to="/ville" onClick={close}>
                  <Icon name="globe" size={16} />
                  Voir l’espace citoyen
                </Link>
                <button type="button" className={styles.popItem} onClick={signOutNow}>
                  <Icon name="logout" size={16} />
                  Se déconnecter
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  )
}
