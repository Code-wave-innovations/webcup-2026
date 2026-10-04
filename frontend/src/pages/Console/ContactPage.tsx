import { useState } from 'react'
import { messageFor } from '../../api/errors'
import type { CreatedContact } from '../../api/requests'
import { usePublicSettings } from '../../api/settings'
import { ContactForm } from '../../features/contact/ContactForm'
import { RequestConfirmation } from '../../features/contact/RequestConfirmation'
import { useMaintenanceMode } from '../../features/maintenance/maintenanceMode'
import { PlatformIncident } from '../../features/maintenance/PlatformIncident'
import styles from '../../features/contact/Contact.module.css'
import { GlassPanel } from '../../ui/GlassPanel'
import text from '../../ui/text.module.css'
import { ConsolePage } from './ConsolePage'

/** D04 / D16: write to municipal services and see an explicit send confirmation. */
export default function ContactPage() {
  const settings = usePublicSettings()
  const readOnly = useMaintenanceMode()
  const [sent, setSent] = useState<CreatedContact | null>(null)
  const contact = settings.data?.support_contact

  return (
    <ConsolePage
      title={readOnly && !sent ? 'Coordonnées et consignes' : 'Écrire à la mairie'}
      lead={
        readOnly && !sent
          ? 'Pendant l’incident, le message en ligne est en pause. Les coordonnées de la mairie et les numéros d’urgence restent là.'
          : 'Transmettez une question ou une difficulté aux services municipaux. Vous recevez tout de suite une confirmation avec une référence.'
      }
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
            <h2>Coordonnées de la mairie</h2>
            {settings.isPending && <p className={text.note}>Chargement des coordonnées…</p>}
            {settings.isError && <p className={text.error}>{messageFor(settings.error)}</p>}
            {contact && (
              <dl>
                <div>
                  <dt>Téléphone</dt>
                  <dd>
                    <a href={`tel:${contact.phone.replace(/\s/g, '')}`}>{contact.phone}</a>
                  </dd>
                </div>
                <div>
                  <dt>E-mail</dt>
                  <dd>
                    <a href={`mailto:${contact.email}`}>{contact.email}</a>
                  </dd>
                </div>
                <div>
                  <dt>Horaires</dt>
                  <dd>{contact.hours}</dd>
                </div>
                <div>
                  <dt>Adresse</dt>
                  <dd>{contact.address}</dd>
                </div>
              </dl>
            )}
            <p className={text.note}>
              {readOnly
                ? 'Ces coordonnées restent le moyen de joindre la mairie pendant l’incident.'
                : 'Le formulaire reste le canal le plus simple pour laisser une trace et un numéro de suivi.'}
            </p>
          </GlassPanel>
        </div>
      )}
    </ConsolePage>
  )
}
