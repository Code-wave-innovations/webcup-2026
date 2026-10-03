import { Link, useLocation } from 'react-router'
import { signOut, useSessionUser } from '../../api/session'
import type { Role } from '../../api/types'
import { airlockPath, rewindToCockpit } from '../../app/airlock'
import { Icon, NovaMark } from '../../ui/Icon'
import chrome from '../CityPage/CityChrome.module.css'
import styles from './ConsoleLayout.module.css'

const ROLE_LABEL: Record<Role, string> = {
  CITIZEN: 'Habitant·e',
  AGENT: 'Agent municipal',
  ADMIN: 'Administration',
}

/** Top bar of the console pages: back to the city, the signed-in account, sign in or out. */
export function ConsoleTopBar() {
  const user = useSessionUser()
  const { pathname, search } = useLocation()

  return (
    <header className={chrome.bar}>
      <Link to="/ville" className={[chrome.brand, styles.brand].join(' ')}>
        <NovaMark />
        <span>NOVA</span>
      </Link>
      <nav className={chrome.links} aria-label="Rubriques">
        <Link to="/ville">Accueil de la ville</Link>
      </nav>
      <div className={chrome.end}>
        {user ? (
          <>
            <div className={chrome.badge}>
              <span>
                {user.name} {user.last_name}
              </span>
              <small>{ROLE_LABEL[user.role]}</small>
            </div>
            <button type="button" className={chrome.round} aria-label="Se déconnecter" onClick={signOut}>
              <Icon name="logout" />
            </button>
          </>
        ) : (
          <Link to={airlockPath(pathname + search)} onClick={rewindToCockpit} className={styles.signIn}>
            Se connecter
          </Link>
        )}
      </div>
    </header>
  )
}
