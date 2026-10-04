import { useState } from 'react'
import { useAppointments } from '../../api/appointments'
import { messageFor } from '../../api/errors'
import { AppointmentTicket } from '../../features/appointments/AppointmentTicket'
import { BrowserReminderOptIn } from '../../features/appointments/ReminderWatcher'
import styles from '../../features/appointments/Booking.module.css'
import { ButtonRouteLink } from '../../ui/Button'
import { GlassPanel } from '../../ui/GlassPanel'
import text from '../../ui/text.module.css'
import { ConsolePage } from './ConsolePage'
import page from './Appointments.module.css'

type Tab = 'upcoming' | 'past'

/** F39 / F40: the resident's appointments: what is coming (reminder, cancellation, calendar), what is past */
export default function MyAppointmentsPage() {
  const [tab, setTab] = useState<Tab>('upcoming')
  const list = useAppointments({ scope: tab })
  // what is still to come first; a cancelled or past-status ticket goes below
  const items = [...(list.data?.data ?? [])].sort((a, b) => Number(b.status === 'BOOKED') - Number(a.status === 'BOOKED'))

  return (
    <ConsolePage
      title="Mes rendez-vous"
      lead="Vos rendez-vous avec les agents de la ville, leur rappel et ce qu’il faut apporter."
      actions={<ButtonRouteLink to="/ville/rendez-vous/nouveau">Prendre rendez-vous</ButtonRouteLink>}
    >
      <div className={page.toolbar}>
        <div className={page.tabs} role="tablist" aria-label="Période">
          {(['upcoming', 'past'] as const).map((value) => (
            <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)}>
              {value === 'upcoming' ? 'À venir' : 'Passés'}
            </button>
          ))}
        </div>
        {tab === 'upcoming' && <BrowserReminderOptIn />}
      </div>

      {list.isError ? (
        <GlassPanel>
          <p className={text.error}>{messageFor(list.error)}</p>
        </GlassPanel>
      ) : list.isPending ? (
        <GlassPanel className={styles.loading} aria-busy="true">
          Chargement de vos rendez-vous…
        </GlassPanel>
      ) : items.length === 0 ? (
        <GlassPanel className={page.empty}>
          <p>{tab === 'upcoming' ? 'Aucun rendez-vous à venir.' : 'Aucun rendez-vous passé.'}</p>
          {tab === 'upcoming' && <ButtonRouteLink to="/ville/rendez-vous/nouveau">Prendre rendez-vous</ButtonRouteLink>}
        </GlassPanel>
      ) : (
        <div className={page.list}>
          {items.map((appointment) => (
            <AppointmentTicket key={appointment.id} appointment={appointment} manage />
          ))}
        </div>
      )}
    </ConsolePage>
  )
}
