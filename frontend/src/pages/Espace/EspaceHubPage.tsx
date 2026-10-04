import { useAppointments } from '../../api/appointments'
import { useCitizenUser } from '../../api/session'
import { countdown } from '../../features/appointments/appointmentModel'
import { useNow } from '../../hooks/useNow'
import { useRequests } from '../../api/requests'
import { messageFor } from '../../api/errors'
import { ButtonRouteLink } from '../../ui/Button'
import { GlassPanel } from '../../ui/GlassPanel'
import text from '../../ui/text.module.css'
import { ConsolePage } from '../Console/ConsolePage'
import styles from './Espace.module.css'

/** D03 / D11 / F39: personal hub — entry to Mes demandes and Mes rendez-vous. */
export default function EspaceHubPage() {
  const user = useCitizenUser()
  const open = useRequests({ scope: 'open', limit: 1 })
  const waiting = useRequests({ status: ['WAITING_CITIZEN'], limit: 1 })
  const district = user?.district?.name
  const now = useNow()
  // F39: the next appointment still to come, and how many are booked
  const upcoming = useAppointments({ scope: 'upcoming', status: 'BOOKED', limit: 1 })
  const next = upcoming.data?.data[0]

  return (
    <ConsolePage
      title="Mon espace"
      lead={
        user
          ? `Bonjour ${user.name}${district ? ` · ${district}` : ''}. Retrouvez ici le suivi de vos démarches et vos rendez-vous.`
          : undefined
      }
    >
      <GlassPanel className={styles.card}>
        <h2>Mes demandes</h2>
        {(open.isPending || waiting.isPending) && <p className={text.note}>Chargement…</p>}
        {open.isError && (
          <p className={text.error}>
            {messageFor(open.error)}{' '}
            <button type="button" onClick={() => void open.refetch()}>
              Réessayer
            </button>
          </p>
        )}
        {open.data && waiting.data && (
          <>
            <p>
              {open.data.meta.total} en cours
              {waiting.data.meta.total > 0 ? ` · ${waiting.data.meta.total} à compléter` : ''}
            </p>
            <div className={styles.cardActions}>
              <ButtonRouteLink to="/ville/espace/demandes">Voir mes demandes</ButtonRouteLink>
            </div>
          </>
        )}
      </GlassPanel>

      <GlassPanel className={styles.card}>
        <h2>Mes rendez-vous</h2>
        {upcoming.isPending && <p className={text.note}>Chargement…</p>}
        {upcoming.isError && (
          <p className={text.error}>
            {messageFor(upcoming.error)}{' '}
            <button type="button" onClick={() => void upcoming.refetch()}>
              Réessayer
            </button>
          </p>
        )}
        {upcoming.data && (
          <>
            {next ? (
              <p>
                Prochain : <strong>{next.service.name}</strong>, {next.when.day_label} de {next.when.start_time} à {next.when.end_time} · {next.where.location} ({countdown(next.when.starts_at, now)})
                {upcoming.data.meta.total > 1 ? ` · ${upcoming.data.meta.total} rendez-vous à venir` : ''}
              </p>
            ) : (
              <p>Aucun rendez-vous à venir.</p>
            )}
            <div className={styles.cardActions}>
              <ButtonRouteLink to="/ville/rendez-vous">Voir mes rendez-vous</ButtonRouteLink>
              <ButtonRouteLink variant="ghost" to="/ville/rendez-vous/nouveau">
                Prendre rendez-vous
              </ButtonRouteLink>
            </div>
          </>
        )}
      </GlassPanel>
    </ConsolePage>
  )
}
