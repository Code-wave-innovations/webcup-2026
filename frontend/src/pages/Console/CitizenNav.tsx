import { Link, useLocation } from 'react-router'
import { useRequests } from '../../api/requests'
import { useCitizenSignedIn } from '../../api/session'
import styles from './CitizenNav.module.css'

const current = (active: boolean) => (active ? 'true' : undefined)

/** Shared Accueil + Contact + Mon espace for the console and the city flyover. */
export function CitizenNav({ variant }: { variant: 'console' | 'flyover' }) {
  const { pathname } = useLocation()
  const signedIn = useCitizenSignedIn()
  const waiting = useRequests({ status: ['WAITING_CITIZEN'], limit: 1 }, signedIn)
  const count = waiting.data?.meta.total ?? 0
  const onEspace = pathname.startsWith('/ville/espace')
  const onContact = pathname === '/ville/contact'

  return (
    <>
      {variant === 'console' && (
        <Link to="/ville" aria-current={current(pathname === '/ville')}>
          Accueil
        </Link>
      )}
      <Link to="/ville/contact" aria-current={current(onContact)}>
        Contact
      </Link>
      <Link to="/ville/espace" aria-current={current(onEspace)} className={styles.espaceLink}>
        Mon espace
        {count > 0 && (
          <span className={styles.badge} aria-label={`${count} demande(s) à compléter`}>
            {count}
          </span>
        )}
      </Link>
    </>
  )
}
