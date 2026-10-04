import { Link, useLocation, useNavigate } from 'react-router'
import { isLightScene, switchScene } from '../../a11y/sceneMode'
import { barePath } from '../../a11y/scenePaths'
import { signOutCitizen, useCitizenUser } from '../../api/session'
import { airlockPath, rewindToCockpit } from '../../app/airlock'
import { useAuthStore } from '../../features/auth/authStore'
import { useReportStore } from '../../features/reports/reportStore'
import { Icon, NovaMark } from '../../ui/Icon'
import chrome from '../CityPage/CityChrome.module.css'
import { CitizenNav } from './CitizenNav'
import styles from './ConsoleLayout.module.css'

/** Top bar of the console pages: habitant JWT (not staff), plus Accueil / Contact / Mon espace. */
export function ConsoleTopBar() {
  const citizen = useCitizenUser()
  const citySession = useAuthStore((s) => s.session)
  const { pathname, search } = useLocation()
  const path = barePath(pathname)
  const navigate = useNavigate()

  const signOutHere = () => {
    useAuthStore.getState().signOut()
    signOutCitizen()
    useReportStore.getState().reset()
    if (isLightScene) navigate('/')
  }

  const signedIn = Boolean(citizen || citySession)

  return (
    <header className={chrome.bar}>
      <div className={chrome.shell}>
        <Link to="/ville" className={[chrome.brand, styles.brand].join(' ')}>
          <NovaMark />
          <span>NOVA</span>
        </Link>
        <nav className={chrome.links} aria-label="Rubriques">
          <CitizenNav variant="console" />
          <Link to="/ville/annonces" aria-current={path.startsWith('/ville/annonces') ? 'true' : undefined}>
            Annonces
          </Link>
          <Link to="/ville/transports" aria-current={path.startsWith('/ville/transports') ? 'true' : undefined}>
            Transports
          </Link>
          {isLightScene && (
            <Link to="/nova" aria-current={path === '/nova' ? 'true' : undefined}>
              Parler à Nova
            </Link>
          )}
        </nav>
        <div className={chrome.end}>
          <button type="button" className={chrome.light} onClick={() => switchScene(isLightScene ? 'complete' : 'light')}>
            {isLightScene ? 'Version complète' : 'Version légère'}
          </button>
          {signedIn ? (
            <button type="button" className={chrome.round} aria-label="Se déconnecter" onClick={signOutHere}>
              <Icon name="logout" />
            </button>
          ) : (
            <Link to={airlockPath(pathname + search)} onClick={rewindToCockpit} className={styles.signIn}>
              Se connecter
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
