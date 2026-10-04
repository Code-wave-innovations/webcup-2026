import { useSearchParams } from 'react-router'
import { BookingFlow } from '../../features/appointments/BookingFlow'
import { ButtonRouteLink } from '../../ui/Button'
import { ConsolePage } from './ConsolePage'

/** F39: book an appointment with an agent (`?service=<slug>` comes from a service's sheet) */
export default function BookAppointmentPage() {
  const [params] = useSearchParams()
  return (
    <ConsolePage
      title="Prendre rendez-vous"
      crumbs={[{ label: 'Mes rendez-vous', to: '/ville/rendez-vous' }]}
      lead="Choisissez un service, un jour et une heure : tout est affiché à l’heure de Terra Nova. Vous saurez avant de valider où aller, avec qui, et quoi apporter."
      actions={
        <ButtonRouteLink variant="ghost" small to="/ville/rendez-vous">
          Mes rendez-vous
        </ButtonRouteLink>
      }
    >
      <BookingFlow initialService={params.get('service')} />
    </ConsolePage>
  )
}
