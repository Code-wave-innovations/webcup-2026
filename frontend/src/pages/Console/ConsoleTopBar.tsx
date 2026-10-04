import { Link, useLocation, useNavigate } from 'react-router'
import { isLightScene, switchScene } from '../../a11y/sceneMode'
import { signOutCitizen, useCitizenUser } from '../../api/session'
import type { Role } from '../../api/types'
import { airlockPath, rewindToCockpit } from '../../app/airlock'
import { useAuthStore } from '../../features/auth/authStore'
import { useReportStore } from '../../features/reports/reportStore'
import { sessionRoleLabel } from '../../features/auth/roleLabel'
import { defineMessages, useLocale, useMessages } from '../../i18n'
import { Icon, NovaMark } from '../../ui/Icon'
import { LanguageSwitch } from '../../ui/LanguageSwitch'
import chrome from '../CityPage/CityChrome.module.css'
import { CitizenNav } from './CitizenNav'
import styles from './ConsoleLayout.module.css'

const messages = defineMessages(
  {
    role: {
      CITIZEN: 'Habitant·e',
      AGENT: 'Agent municipal',
      ADMIN: 'Administration',
    } satisfies Record<Role, string>,
    sections: 'Rubriques',
    signOut: 'Se déconnecter',
    signIn: 'Se connecter',
    announcements: 'Annonces',
    transports: 'Transports',
    talkToNova: 'Parler à Nova',
    completeVersion: 'Version complète',
    lightVersion: 'Version légère',
  },
  {
    role: {
      CITIZEN: 'Resident',
      AGENT: 'Municipal agent',
      ADMIN: 'Administration',
    },
    sections: 'Sections',
    signOut: 'Sign out',
    signIn: 'Sign in',
    announcements: 'Announcements',
    transports: 'Transport',
    talkToNova: 'Talk to Nova',
    completeVersion: 'Full version',
    lightVersion: 'Light version',
  },
)

/** Top bar of the console pages: habitant JWT (not staff), plus Accueil / Contact / Mon espace. */
export function ConsoleTopBar() {
  const citizen = useCitizenUser()
  const citySession = useAuthStore((s) => s.session)
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const m = useMessages(messages)
  const locale = useLocale()

  const signOutHere = () => {
    useAuthStore.getState().signOut()
    signOutCitizen()
    useReportStore.getState().reset()
    if (isLightScene) navigate('/')
  }

  const account = citizen
    ? {
        name: `${citizen.name} ${citizen.last_name}`.trim(),
        label: m.role[citizen.role],
      }
    : citySession
      ? {
          name: citySession.name,
          label: sessionRoleLabel(citySession, locale),
        }
      : null

  return (
    <header className={chrome.bar}>
      <div className={chrome.shell}>
        <Link to="/ville" className={[chrome.brand, styles.brand].join(' ')}>
          <NovaMark />
          <span>NOVA</span>
        </Link>
        <nav className={chrome.links} aria-label={m.sections}>
          <CitizenNav variant="console" />
          <Link to="/ville/annonces" aria-current={pathname.startsWith('/ville/annonces') ? 'true' : undefined}>
            {m.announcements}
          </Link>
          <Link to="/ville/transports" aria-current={pathname.startsWith('/ville/transports') ? 'true' : undefined}>
            {m.transports}
          </Link>
          {isLightScene && (
            <Link to="/nova" aria-current={pathname === '/nova' ? 'true' : undefined}>
              {m.talkToNova}
            </Link>
          )}
        </nav>
        <div className={[chrome.end, styles.end].join(' ')}>
          <LanguageSwitch />
          <button type="button" className={styles.sceneSwitch} onClick={() => switchScene(isLightScene ? 'complete' : 'light')}>
            {isLightScene ? m.completeVersion : m.lightVersion}
          </button>
          {account ? (
            <>
              <div className={[chrome.badge, styles.account].join(' ')}>
                <span>{account.name}</span>
                <small>{account.label}</small>
              </div>
              <button type="button" className={chrome.round} aria-label={m.signOut} title={m.signOut} onClick={signOutHere}>
                <Icon name="logout" />
              </button>
            </>
          ) : (
            <Link to={airlockPath(pathname + search)} onClick={rewindToCockpit} className={styles.signIn}>
              {m.signIn}
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
