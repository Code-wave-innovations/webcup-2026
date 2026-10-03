import { NavLink, useLocation } from 'react-router'
import { motion } from 'motion/react'
import { NAV } from '../nav'
import type { Persona } from '../mocks/types'
import { Icon } from '../ui/Icon'
import { Counter } from '../ui/Badges'
import { useBadges } from './useBadges'
import styles from './Shell.module.css'

interface SidebarProps {
  persona: Persona
  collapsed: boolean
  onToggleCollapsed: () => void
  /** Phone drawer state */
  open: boolean
  onNavigate: () => void
}

const isActive = (pathname: string, path: string) =>
  path === '/agent' || path === '/admin' ? pathname === path : pathname === path || pathname.startsWith(`${path}/`)

export function Sidebar({ persona, collapsed, onToggleCollapsed, open, onNavigate }: SidebarProps) {
  const { pathname } = useLocation()
  const badges = useBadges()
  return (
    <nav
      id="bo-sidebar"
      className={[styles.sidebar, collapsed && styles.collapsed, open && styles.open].filter(Boolean).join(' ')}
      aria-label={persona === 'ADMIN' ? 'Navigation administration' : 'Navigation agent'}
    >
      <div className={styles.brand}>
        <span className={styles.brandMark} aria-hidden="true" />
        <span className={styles.brandText}>
          NOVA<small>{persona === 'ADMIN' ? 'Administration' : 'Espace agent'}</small>
        </span>
      </div>

      <div className={styles.navScroll}>
        {NAV[persona].map((group) => (
          <div key={group.label} className={styles.navGroup}>
            <p className={styles.navGroupLabel}>{group.label}</p>
            <ul>
              {group.items.map((item) => {
                const active = isActive(pathname, item.path)
                const count = item.badge ? badges[item.badge] : 0
                return (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      end={item.path === '/agent' || item.path === '/admin'}
                      className={styles.navLink}
                      onClick={onNavigate}
                      title={collapsed ? item.label : undefined}
                    >
                      {active && <motion.span layoutId={`nav-active-${persona}`} className={styles.navActive} transition={{ type: 'spring', stiffness: 420, damping: 36 }} />}
                      <Icon name={item.icon} size={19} />
                      <span className={styles.navLabel}>{item.label}</span>
                      {count > 0 && (
                        <span className={styles.navBadge}>
                          <Counter value={count} tone={item.badge === 'activeAlerts' || item.badge === 'interruptions' ? 'alert' : 'ember'} label={`${count} en attente`} />
                        </span>
                      )}
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>

      <button type="button" className={styles.collapse} onClick={onToggleCollapsed} aria-expanded={!collapsed} aria-controls="bo-sidebar">
        <Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} size={16} />
        <span className={styles.navLabel}>{collapsed ? 'Déplier le menu' : 'Replier le menu'}</span>
      </button>
    </nav>
  )
}
