import { Link, useLocation } from 'react-router'
import { useRequests } from '../../api/requests'
import { useCitizenSignedIn } from '../../api/session'
import { defineMessages, useMessages } from '../../i18n'
import styles from './CitizenNav.module.css'

const messages = defineMessages(
  {
    home: 'Accueil',
    contact: 'Contact',
    appointments: 'Mes rendez-vous',
    espace: 'Mon espace',
    espaceShort: 'Espace',
    waiting: (n: number) => (n > 1 ? `${n} demandes à compléter` : `${n} demande à compléter`),
  },
  {
    home: 'Home',
    contact: 'Contact',
    appointments: 'My appointments',
    espace: 'My space',
    espaceShort: 'My space',
    waiting: (n) => (n === 1 ? '1 request needs your input' : `${n} requests need your input`),
  },
)

const current = (active: boolean) => (active ? 'true' : undefined)

/** Shared Accueil + Contact + Mes rendez-vous (console) + Mon espace for the console and the city flyover. */
export function CitizenNav({ variant }: { variant: 'console' | 'flyover' }) {
  const { pathname } = useLocation()
  const signedIn = useCitizenSignedIn()
  const waiting = useRequests({ status: ['WAITING_CITIZEN'], limit: 1 }, signedIn)
  const count = waiting.data?.meta.total ?? 0
  const onEspace = pathname.startsWith('/ville/espace')
  const onContact = pathname === '/ville/contact'
  const onAppointments = pathname.startsWith('/ville/rendez-vous')
  const flyover = variant === 'flyover'
  const m = useMessages(messages)

  return (
    <>
      {variant === 'console' && (
        <Link to="/ville" aria-current={current(pathname === '/ville')}>
          {m.home}
        </Link>
      )}
      <Link to="/ville/contact" aria-current={current(onContact)}>
        {m.contact}
      </Link>
      {/* F39 / F40: the resident's appointments (the flyover bar keeps its sections) */}
      {variant === 'console' && (
        <Link to="/ville/rendez-vous" aria-current={current(onAppointments)}>
          {m.appointments}
        </Link>
      )}
      <Link
        to="/ville/espace"
        aria-current={current(onEspace)}
        className={styles.espaceLink}
        title={m.espace}
      >
        {flyover ? m.espaceShort : m.espace}
        {count > 0 && (
          <span className={styles.badge} aria-label={m.waiting(count)}>
            {count}
          </span>
        )}
      </Link>
    </>
  )
}
