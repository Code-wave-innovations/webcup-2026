import { Link, useLocation } from 'react-router'
import { signOutCitizen, useCitizenUser } from '../../api/session'
import { airlockPath, rewindToCockpit } from '../../app/airlock'
import { useAuthStore } from '../../features/auth/authStore'
import { Icon, NovaMark } from '../../ui/Icon'
import chrome from '../CityPage/CityChrome.module.css'
import styles from './ConsoleLayout.module.css'

/** Top bar of the console pages: back to the city, the signed-in habitant (not a leftover staff JWT). */
export function ConsoleTopBar() {
  const citizen = useCitizenUser()
  const citySession = useAuthStore((s) => s.session)
  const { pathname, search } = useLocation()

  const account = citizen
    ? {
        name: `${citizen.name} ${citizen.last_name}`.trim(),
        label: 'Habitant·e',
        onSignOut: signOutCitizen,
      }
    : citySession
      ? {
          name: citySession.name,
          label: citySession.roleLabel,
          onSignOut: () => useAuthStore.getState().signOut(),
        }
      : null

  return (
    <header className={chrome.bar}>
      <Link to="/ville" className={[chrome.brand, styles.brand].join(' ')}>
        <NovaMark />
        <span>NOVA</span>
      </Link>
      <nav className={chrome.links} aria-label="Rubriques">
        <Link to="/ville">Accueil de la ville</Link>
        <Link to="/ville#conseil">Contact</Link>
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
