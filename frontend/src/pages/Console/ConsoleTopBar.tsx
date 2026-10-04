import { Link, useLocation } from 'react-router'
import { signOutCitizen, useCitizenUser } from '../../api/session'
import type { Role } from '../../api/types'
import { airlockPath, rewindToCockpit } from '../../app/airlock'
import { useAuthStore } from '../../features/auth/authStore'
import { Icon, NovaMark } from '../../ui/Icon'
import chrome from '../CityPage/CityChrome.module.css'
import { CitizenNav } from './CitizenNav'
import styles from './ConsoleLayout.module.css'

const ROLE_LABEL: Record<Role, string> = {
  CITIZEN: 'Habitant·e',
  AGENT: 'Agent municipal',
  ADMIN: 'Administration',
}

function signOutFilmAndCitizen() {
  useAuthStore.getState().signOut()
  signOutCitizen()
}

/** Top bar of the console pages: habitant JWT (not staff), plus Accueil / Contact / Mon espace. */
export function ConsoleTopBar() {
  const citizen = useCitizenUser()
  const citySession = useAuthStore((s) => s.session)
  const { pathname, search } = useLocation()

  const account = citizen
    ? {
        name: `${citizen.name} ${citizen.last_name}`.trim(),
        label: ROLE_LABEL[citizen.role],
        onSignOut: signOutFilmAndCitizen,
      }
    : citySession
      ? {
          name: citySession.name,
          label: citySession.roleLabel,
          onSignOut: signOutFilmAndCitizen,
        }
      : null

  return (
    <header className={chrome.bar}>
      <Link to="/ville" className={[chrome.brand, styles.brand].join(' ')}>
        <NovaMark />
        <span>NOVA</span>
      </Link>
      <nav className={chrome.links} aria-label="Rubriques">
        <CitizenNav variant="console" />
      </nav>
      <div className={chrome.end}>
        {account ? (
          <>
            <div className={chrome.badge}>
              <span>{account.name}</span>
              <small>{account.label}</small>
            </div>
            <button type="button" className={chrome.round} aria-label="Se déconnecter" onClick={account.onSignOut}>
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
