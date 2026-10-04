import { Link, useLocation } from 'react-router'
import { barePath } from '../../a11y/scenePaths'
import { useRequests } from '../../api/requests'
import { useCitizenSignedIn } from '../../api/session'
import styles from './CitizenNav.module.css'

const current = (active: boolean) => (active ? 'true' : undefined)

/** Shared Accueil + Contact + Mes rendez-vous (console) + Mon espace for the console and the city flyover. */
export function CitizenNav({ variant }: { variant: 'console' | 'flyover' }) {
  const path = barePath(useLocation().pathname)
  const signedIn = useCitizenSignedIn()
  const waiting = useRequests({ status: ['WAITING_CITIZEN'], limit: 1 }, signedIn)
  const count = waiting.data?.meta.total ?? 0
  const onEspace = path.startsWith('/ville/espace')
  const onContact = path === '/ville/contact'
  const onAppointments = path.startsWith('/ville/rendez-vous')
  const flyover = variant === 'flyover'

  return (
    <>
      {variant === 'console' && (
        <Link to="/ville" aria-current={current(path === '/ville')}>
          Accueil
        </Link>
      )}
      <Link to="/ville/contact" aria-current={current(onContact)}>
        Contact
      </Link>
      {/* F39 / F40: the resident's appointments (the flyover bar keeps its sections) */}
      {variant === 'console' && (
        <Link to="/ville/rendez-vous" aria-current={current(onAppointments)}>
          Mes rendez-vous
        </Link>
      )}
      <Link
        to="/ville/espace"
        aria-current={current(onEspace)}
        className={styles.espaceLink}
        title="Mon espace"
      >
        {flyover ? 'Espace' : 'Mon espace'}
        {count > 0 && (
          <span className={styles.badge} aria-label={`${count} demande(s) à compléter`}>
            {count}
          </span>
        )}
      </Link>
    </>
  )
}
