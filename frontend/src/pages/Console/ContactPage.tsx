import { ContactPanel } from '../../features/contact/ContactPanel'
import { useMaintenanceMode } from '../../features/maintenance/maintenanceMode'
import { defineMessages, useMessages } from '../../i18n'
import { ConsolePage } from './ConsolePage'

const messages = defineMessages(
  {
    titleIncident: 'Coordonnées et consignes',
    title: 'Écrire à la mairie',
    leadIncident: 'Pendant l’incident, le message en ligne est en pause. Les coordonnées de la mairie et les numéros d’urgence restent là.',
    lead: 'Transmettez une question ou une difficulté aux services municipaux. Vous recevez tout de suite une confirmation avec une référence.',
  },
  {
    titleIncident: 'Contact details and guidance',
    title: 'Write to the city hall',
    leadIncident: 'During the incident, online messages are paused. The city hall’s contact details and the emergency numbers are still here.',
    lead: 'Send a question or a problem to the municipal services. You get a confirmation with a reference straight away.',
  },
)

/** D04 / D16: write to municipal services and see an explicit send confirmation. */
export default function ContactPage() {
  const readOnly = useMaintenanceMode()
  const m = useMessages(messages)

  return (
    <ConsolePage title={readOnly ? m.titleIncident : m.title} lead={readOnly ? m.leadIncident : m.lead}>
      <ContactPanel />
    </ConsolePage>
  )
}
