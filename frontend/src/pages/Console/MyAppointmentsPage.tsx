import { useState } from 'react'
import { useAppointments } from '../../api/appointments'
import { messageFor } from '../../api/errors'
import { AppointmentTicket } from '../../features/appointments/AppointmentTicket'
import { BrowserReminderOptIn } from '../../features/appointments/ReminderWatcher'
import styles from '../../features/appointments/Booking.module.css'
import { defineMessages, useMessages } from '../../i18n'
import { ButtonRouteLink } from '../../ui/Button'
import { GlassPanel } from '../../ui/GlassPanel'
import text from '../../ui/text.module.css'
import { ConsolePage } from './ConsolePage'
import page from './Appointments.module.css'

type Tab = 'upcoming' | 'past'

const messages = defineMessages(
  {
    title: 'Mes rendez-vous',
    lead: 'Vos rendez-vous avec les agents de la ville, leur rappel et ce qu’il faut apporter.',
    book: 'Prendre rendez-vous',
    period: 'Période',
    upcoming: 'À venir',
    past: 'Passés',
    loading: 'Chargement de vos rendez-vous…',
    noUpcoming: 'Aucun rendez-vous à venir.',
    noPast: 'Aucun rendez-vous passé.',
  },
  {
    title: 'My appointments',
    lead: 'Your appointments with the city’s agents, their reminders and what to bring.',
    book: 'Book an appointment',
    period: 'Period',
    upcoming: 'Upcoming',
    past: 'Past',
    loading: 'Loading your appointments…',
    noUpcoming: 'No upcoming appointments.',
    noPast: 'No past appointments.',
  },
)

/** F39 / F40: the resident's appointments: what is coming (reminder, cancellation, calendar), what is past */
export default function MyAppointmentsPage() {
  const m = useMessages(messages)
  const [tab, setTab] = useState<Tab>('upcoming')
  const list = useAppointments({ scope: tab })
  // what is still to come first; a cancelled or past-status ticket goes below
  const items = [...(list.data?.data ?? [])].sort((a, b) => Number(b.status === 'BOOKED') - Number(a.status === 'BOOKED'))

  return (
    <ConsolePage
      title={m.title}
      lead={m.lead}
      actions={<ButtonRouteLink to="/ville/rendez-vous/nouveau">{m.book}</ButtonRouteLink>}
    >
      <div className={page.toolbar}>
        <div className={page.tabs} role="tablist" aria-label={m.period}>
          {(['upcoming', 'past'] as const).map((value) => (
            <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)}>
              {value === 'upcoming' ? m.upcoming : m.past}
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
          {m.loading}
        </GlassPanel>
      ) : items.length === 0 ? (
        <GlassPanel className={page.empty}>
          <p>{tab === 'upcoming' ? m.noUpcoming : m.noPast}</p>
          {tab === 'upcoming' && <ButtonRouteLink to="/ville/rendez-vous/nouveau">{m.book}</ButtonRouteLink>}
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
