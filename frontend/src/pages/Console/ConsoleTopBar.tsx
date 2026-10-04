import { Link, useLocation, useNavigate } from 'react-router'
import { isLightScene, switchScene } from '../../a11y/sceneMode'
import { signOut, useSessionUser } from '../../api/session'
import type { Role } from '../../api/types'
import { airlockPath, rewindToCockpit } from '../../app/airlock'
import { useAuthStore } from '../../features/auth/authStore'
import { useReportStore } from '../../features/reports/reportStore'
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
  const airlockSession = useAuthStore((s) => s.session)
  const { pathname, search } = useLocation()
  const navigate = useNavigate()

  // F96: the light version signs in through its own airlock (the demo session), so it shows and closes that one too
  const signOutLight = () => {
    signOut()
    useReportStore.getState().reset()
    useAuthStore.getState().signOut()
    navigate('/')
  }

  return (
    <header className={chrome.bar}>
      <Link to="/ville" className={[chrome.brand, styles.brand].join(' ')}>
        <NovaMark />
        <span>NOVA</span>
      </Link>
      <nav className={chrome.links} aria-label="Rubriques">
        <Link to="/ville" aria-current={pathname === '/ville' ? 'true' : undefined}>
          Accueil de la ville
        </Link>
        <Link to="/ville/annonces" aria-current={pathname.startsWith('/ville/annonces') ? 'true' : undefined}>
          Annonces
        </Link>
        <Link to="/ville/transports" aria-current={pathname.startsWith('/ville/transports') ? 'true' : undefined}>
          Transports
        </Link>
        {isLightScene && (
          <Link to="/nova" aria-current={pathname === '/nova' ? 'true' : undefined}>
            Parler à Nova
          </Link>
        )}
      </nav>
      <div className={chrome.end}>
        <button type="button" className={styles.sceneSwitch} onClick={() => switchScene(isLightScene ? 'complete' : 'light')}>
          {isLightScene ? 'Version complète' : 'Version légère'}
        </button>
        {isLightScene && airlockSession ? (
          <>
            <div className={chrome.badge}>
              <span>{airlockSession.name}</span>
              <small>{airlockSession.roleLabel}</small>
            </div>
            <button type="button" className={chrome.round} aria-label="Se déconnecter" onClick={signOutLight}>
              <Icon name="logout" />
            </button>
          </>
        ) : user ? (
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
