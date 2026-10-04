import { useState } from 'react'
import { messageFor } from '../../api/errors'
import { isNetworkFailure } from '../../api/essentialCache'
import type { CreatedContact } from '../../api/requests'
import { usePublicSettings } from '../../api/settings'
import { ContactForm } from '../../features/contact/ContactForm'
import { RequestConfirmation } from '../../features/contact/RequestConfirmation'
import { useMaintenanceMode } from '../../features/maintenance/maintenanceMode'
import { PlatformIncident } from '../../features/maintenance/PlatformIncident'
import { defineMessages, useMessages } from '../../i18n'
import styles from '../../features/contact/Contact.module.css'
import { GlassPanel } from '../../ui/GlassPanel'
import text from '../../ui/text.module.css'
import { ConsolePage } from './ConsolePage'

const messages = defineMessages(
  {
    titleIncident: 'Coordonnées et consignes',
    title: 'Écrire à la mairie',
    leadIncident: 'Pendant l’incident, le message en ligne est en pause. Les coordonnées de la mairie et les numéros d’urgence restent là.',
    lead: 'Transmettez une question ou une difficulté aux services municipaux. Vous recevez tout de suite une confirmation avec une référence.',
    asideTitle: 'Coordonnées de la mairie',
    loading: 'Chargement des coordonnées…',
    phone: 'Téléphone',
    email: 'E-mail',
    hours: 'Horaires',
    address: 'Adresse',
    noteIncident: 'Ces coordonnées restent le moyen de joindre la mairie pendant l’incident.',
    note: 'Le formulaire reste le canal le plus simple pour laisser une trace et un numéro de suivi.',
  },
  {
    titleIncident: 'Contact details and guidance',
    title: 'Write to the city hall',
    leadIncident: 'During the incident, online messages are paused. The city hall’s contact details and the emergency numbers are still here.',
    lead: 'Send a question or a problem to the municipal services. You get a confirmation with a reference straight away.',
    asideTitle: 'City hall contact details',
    loading: 'Loading contact details…',
    phone: 'Phone',
    email: 'E-mail',
    hours: 'Opening hours',
    address: 'Address',
    noteIncident: 'These details remain the way to reach the city hall during the incident.',
    note: 'The form is still the simplest way to leave a record and get a tracking number.',
  },
)

/** D04 / D16: write to municipal services and see an explicit send confirmation. */
export default function ContactPage() {
  const settings = usePublicSettings()
  const readOnly = useMaintenanceMode()
  const [sent, setSent] = useState<CreatedContact | null>(null)
  const contact = settings.data?.support_contact
  const m = useMessages(messages)

  return (
    <ConsolePage
      title={readOnly && !sent ? m.titleIncident : m.title}
      lead={readOnly && !sent ? m.leadIncident : m.lead}
    >
      {sent ? (
        <GlassPanel>
          <RequestConfirmation
            reference={sent.reference}
            message={sent.message}
            onAgain={() => setSent(null)}
          />
        </GlassPanel>
      ) : (
        <div className={styles.layout}>
          {readOnly ? <PlatformIncident showContacts={false} linkTo="city" /> : <ContactForm onSent={setSent} />}
          <GlassPanel className={styles.aside}>
            <h2>{m.asideTitle}</h2>
            {settings.isPending && <p className={text.note}>{m.loading}</p>}
            {settings.isError && (!contact || !isNetworkFailure(settings.error)) && <p className={text.error}>{messageFor(settings.error)}</p>}
            {contact && (
              <dl>
                <div>
                  <dt>{m.phone}</dt>
                  <dd>
                    <a href={`tel:${contact.phone.replace(/\s/g, '')}`}>{contact.phone}</a>
                  </dd>
                </div>
                <div>
                  <dt>{m.email}</dt>
                  <dd>
                    <a href={`mailto:${contact.email}`}>{contact.email}</a>
                  </dd>
                </div>
                <div>
                  <dt>{m.hours}</dt>
                  <dd>{contact.hours}</dd>
                </div>
                <div>
                  <dt>{m.address}</dt>
                  <dd>{contact.address}</dd>
                </div>
              </dl>
            )}
            <p className={text.note}>
              {readOnly ? m.noteIncident : m.note}
            </p>
          </GlassPanel>
        </div>
      )}
    </ConsolePage>
  )
}
