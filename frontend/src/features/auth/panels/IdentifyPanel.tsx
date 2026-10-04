import { useState, type RefObject } from 'react'
import { isLightScene } from '../../../a11y/sceneMode'
import { defineMessages, useMessages } from '../../../i18n'
import { Button, ButtonRouteLink } from '../../../ui/Button'
import { ConfirmDialog } from '../../../ui/ConfirmDialog'
import { Field } from '../../../ui/Field'
import { ContactPanel } from '../../contact/ContactPanel'
import styles from '../AccessHologram.module.css'

const messages = defineMessages(
  {
    beside: 'reste à votre gauche.',
    lead: 'Entrez l’e-mail ou l’identifiant rattaché à votre dossier citoyen — inscription ou entrée, le sas décidera.',
    label: 'E-mail ou identifiant',
    hint: 'Ex. habitante@terra-nova.city · ou un identifiant court',
    checking: 'Vérification',
    next: 'Continuer',
    contact: 'Écrire à la mairie',
    contactClose: 'Fermer',
    staff: 'Accès agent / administration',
  },
  {
    beside: 'stays on your left.',
    lead: 'Enter the e-mail or identifier linked to your citizen record — sign-up or sign-in, the airlock will decide.',
    label: 'E-mail or identifier',
    hint: 'E.g. resident@terra-nova.city · or a short identifier',
    checking: 'Checking',
    next: 'Continue',
    contact: 'Write to the city hall',
    contactClose: 'Close',
    staff: 'Staff / administration access',
  },
)

interface IdentifyPanelProps {
  identifier: string
  error: string | null
  checking: boolean
  identifierRef: RefObject<HTMLInputElement | null>
  onChange: (value: string) => void
}

export function IdentifyPanel({ identifier, error, checking, identifierRef, onChange }: IdentifyPanelProps) {
  const m = useMessages(messages)
  const [contactOpen, setContactOpen] = useState(false)

  return (
    <div className={`${styles.panel} ${styles.panelEnter}`}>
      <p className={styles.lead}>
        {/* F96: no Nova beside the panel in the light version */}
        {isLightScene ? null : (
          <>
            <strong>Nova</strong> {m.beside}{' '}
          </>
        )}
        {m.lead}
      </p>
      <Field label={m.label} htmlFor="access-id" error={error}>
        <span className={styles.sight}>
          <input
            ref={identifierRef}
            id="access-id"
            name="identifier"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            inputMode="email"
            placeholder="miora@terra-nova.city"
            value={identifier}
            readOnly={checking}
            onChange={(e) => onChange(e.target.value)}
          />
        </span>
      </Field>
      <p className={styles.hint}>{m.hint}</p>
      <div className={styles.actions}>
        <Button type="submit" className={styles.submit} disabled={checking} data-nova-look>
          {checking ? (
            <>
              <span className={styles.spinner} aria-hidden="true" /> {m.checking}
            </>
          ) : (
            m.next
          )}
        </Button>
        <Button type="button" variant="ghost" small className={styles.staffLink} onClick={() => setContactOpen(true)}>
          {m.contact}
        </Button>
        <ButtonRouteLink to="/agent" variant="ghost" small className={styles.staffLink}>
          {m.staff}
        </ButtonRouteLink>
      </div>

      <ConfirmDialog
        open={contactOpen}
        title={m.contact}
        size="wide"
        onClose={() => setContactOpen(false)}
        footer={
          <Button type="button" variant="ghost" onClick={() => setContactOpen(false)}>
            {m.contactClose}
          </Button>
        }
      >
        <ContactPanel showLead />
      </ConfirmDialog>
    </div>
  )
}
