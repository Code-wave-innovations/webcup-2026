import { useState } from 'react'
import type { CreatedContact } from '../../api/requests'
import { useMaintenanceMode } from '../maintenance/maintenanceMode'
import { PlatformIncident } from '../maintenance/PlatformIncident'
import { ContactForm } from './ContactForm'
import { RequestConfirmation } from './RequestConfirmation'
import styles from './Contact.module.css'

/**
 * Contact card for the Tour du Conseil flyover stop (D04): same glass panel pattern as
 * Signaler / Parler à Nova, linked to the `conseil` landmark by the luminous line.
 */
export function ContactPanel() {
  const [sent, setSent] = useState<CreatedContact | null>(null)
  const readOnly = useMaintenanceMode()

  if (sent) {
    return (
      <div className={styles.panel}>
        <RequestConfirmation
          reference={sent.reference}
          message={sent.message}
          embedded
          onAgain={() => setSent(null)}
        />
      </div>
    )
  }

  if (readOnly) return <PlatformIncident nested />

  return (
    <div className={styles.panel}>
      <p className={styles.bubble}>
        <b>Relations citoyennes</b>
        Écrivez depuis la Tour du Conseil. Nom, message, et vous repartez avec une référence.
      </p>
      <ContactForm embedded onSent={setSent} />
    </div>
  )
}
