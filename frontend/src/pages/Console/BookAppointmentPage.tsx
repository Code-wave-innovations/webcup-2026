import { useSearchParams } from 'react-router'
import { BookingFlow } from '../../features/appointments/BookingFlow'
import { defineMessages, useMessages } from '../../i18n'
import { ButtonRouteLink } from '../../ui/Button'
import { ConsolePage } from './ConsolePage'

const messages = defineMessages(
  {
    title: 'Prendre rendez-vous',
    mine: 'Mes rendez-vous',
    lead: 'Choisissez un service, un jour et une heure : tout est affiché à l’heure de Terra Nova. Vous saurez avant de valider où aller, avec qui, et quoi apporter.',
  },
  {
    title: 'Book an appointment',
    mine: 'My appointments',
    lead: 'Choose a service, a day and a time: everything is shown in Terra Nova time. Before confirming, you will know where to go, who you will see and what to bring.',
  },
)

/** F39: book an appointment with an agent (`?service=<slug>` comes from a service's sheet) */
export default function BookAppointmentPage() {
  const [params] = useSearchParams()
  const m = useMessages(messages)
  return (
    <ConsolePage
      title={m.title}
      crumbs={[{ label: m.mine, to: '/ville/rendez-vous' }]}
      lead={m.lead}
      actions={
        <ButtonRouteLink variant="ghost" small to="/ville/rendez-vous">
          {m.mine}
        </ButtonRouteLink>
      }
    >
      <BookingFlow initialService={params.get('service')} />
    </ConsolePage>
  )
}
