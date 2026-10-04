import { useState } from 'react'
import { useAppointments } from '../../api/appointments'
import { dismissFailedLoginNotice, readFailedLoginNotice, useCitizenUser } from '../../api/session'
import { countdown } from '../../features/appointments/appointmentModel'
import { useNow } from '../../hooks/useNow'
import { useRequests } from '../../api/requests'
import { messageFor } from '../../api/errors'
import { defineMessages, useMessages } from '../../i18n'
import { ButtonRouteLink } from '../../ui/Button'
import { GlassPanel } from '../../ui/GlassPanel'
import text from '../../ui/text.module.css'
import { ConsolePage } from '../Console/ConsolePage'
import { espaceMessages } from './espace.messages'
import styles from './Espace.module.css'

const messages = defineMessages(
  {
    lead: (name: string, district?: string) =>
      `Bonjour ${name}${district ? ` · ${district}` : ''}. Retrouvez ici le suivi de vos démarches et vos rendez-vous.`,
    open: (n: number) => `${n} en cours`,
    waiting: (n: number) => ` · ${n} à compléter`,
    seeRequests: 'Voir mes demandes',
    appointments: 'Mes rendez-vous',
    next: 'Prochain : ',
    slot: (day: string, start: string, end: string) => `${day} de ${start} à ${end}`,
    upcoming: (n: number) => ` · ${n} rendez-vous à venir`,
    none: 'Aucun rendez-vous à venir.',
    seeAppointments: 'Voir mes rendez-vous',
    book: 'Prendre rendez-vous',
    account: 'Compte',
    accountText: 'Modifier vos informations ou fermer votre compte citoyen.',
    manage: 'Gérer mon compte',
    // F37
    securityNotice: (n: number) =>
      `${n} tentative${n > 1 ? 's' : ''} de connexion ${n > 1 ? 'ont échoué' : 'a échoué'} depuis votre dernière visite. Si ce n’était pas vous, changez votre mot de passe.`,
    securityDismiss: 'Compris',
  },
  {
    lead: (name, district) => `Hello ${name}${district ? ` · ${district}` : ''}. Follow your procedures and your appointments here.`,
    open: (n) => `${n} in progress`,
    waiting: (n) => ` · ${n} awaiting your input`,
    seeRequests: 'See my requests',
    appointments: 'My appointments',
    next: 'Next: ',
    slot: (day, start, end) => `${day} from ${start} to ${end}`,
    upcoming: (n) => ` · ${n} upcoming appointments`,
    none: 'No upcoming appointments.',
    seeAppointments: 'See my appointments',
    book: 'Book an appointment',
    account: 'Account',
    accountText: 'Update your details or close your citizen account.',
    manage: 'Manage my account',
    securityNotice: (n) =>
      `${n} failed sign-in attempt${n > 1 ? 's' : ''} since your last visit. If that was not you, change your password.`,
    securityDismiss: 'Got it',
  },
)

/** D03 / D11 / F33 / F39: personal hub — demandes, rendez-vous, compte. F37: failed-login notice. */
export default function EspaceHubPage() {
  const user = useCitizenUser()
  const open = useRequests({ scope: 'open', limit: 1 })
  const waiting = useRequests({ status: ['WAITING_CITIZEN'], limit: 1 })
  const district = user?.district?.name
  const now = useNow()
  // F39: the next appointment still to come, and how many are booked
  const upcoming = useAppointments({ scope: 'upcoming', status: 'BOOKED', limit: 1 })
  const next = upcoming.data?.data[0]
  const m = useMessages(messages)
  const common = useMessages(espaceMessages)
  const [failedAttempts, setFailedAttempts] = useState(() => readFailedLoginNotice())

  const dismissSecurityNotice = () => {
    dismissFailedLoginNotice()
    setFailedAttempts(null)
  }

  return (
    <ConsolePage title={common.espace} lead={user ? m.lead(user.name, district) : undefined}>
      {failedAttempts != null && failedAttempts > 0 && (
        <GlassPanel className={styles.securityNotice} role="status">
          <p>{m.securityNotice(failedAttempts)}</p>
          <div className={styles.cardActions}>
            <button type="button" className={styles.dismiss} onClick={dismissSecurityNotice}>
              {m.securityDismiss}
            </button>
          </div>
        </GlassPanel>
      )}

      <div className={styles.hubGrid}>
        <GlassPanel className={styles.card}>
          <h2>{common.requests}</h2>
          {(open.isPending || waiting.isPending) && <p className={text.note}>{common.loading}</p>}
          {open.isError && (
            <p className={text.error}>
              {messageFor(open.error)}{' '}
              <button type="button" onClick={() => void open.refetch()}>
                {common.retry}
              </button>
            </p>
          )}
          {open.data && waiting.data && (
            <>
              <p>
                {m.open(open.data.meta.total)}
                {waiting.data.meta.total > 0 ? m.waiting(waiting.data.meta.total) : ''}
              </p>
              <div className={styles.cardActions}>
                <ButtonRouteLink to="/ville/espace/demandes">{m.seeRequests}</ButtonRouteLink>
              </div>
            </>
          )}
        </GlassPanel>

        <GlassPanel className={styles.card}>
          <h2>{m.appointments}</h2>
          {upcoming.isPending && <p className={text.note}>{common.loading}</p>}
          {upcoming.isError && (
            <p className={text.error}>
              {messageFor(upcoming.error)}{' '}
              <button type="button" onClick={() => void upcoming.refetch()}>
                {common.retry}
              </button>
            </p>
          )}
          {upcoming.data && (
            <>
              {next ? (
                <p>
                  {m.next}
                  <strong>{next.service.name}</strong>, {m.slot(next.when.day_label, next.when.start_time, next.when.end_time)} ·{' '}
                  {next.where.location} ({countdown(next.when.starts_at, now)})
                  {upcoming.data.meta.total > 1 ? m.upcoming(upcoming.data.meta.total) : ''}
                </p>
              ) : (
                <p>{m.none}</p>
              )}
              <div className={styles.cardActions}>
                <ButtonRouteLink to="/ville/rendez-vous">{m.seeAppointments}</ButtonRouteLink>
                <ButtonRouteLink variant="ghost" to="/ville/rendez-vous/nouveau">
                  {m.book}
                </ButtonRouteLink>
              </div>
            </>
          )}
        </GlassPanel>

        <GlassPanel className={styles.card}>
          <h2>{m.account}</h2>
          <p>{m.accountText}</p>
          <div className={styles.cardActions}>
            <ButtonRouteLink to="/ville/espace/compte">{m.manage}</ButtonRouteLink>
          </div>
        </GlassPanel>
      </div>
    </ConsolePage>
  )
}
