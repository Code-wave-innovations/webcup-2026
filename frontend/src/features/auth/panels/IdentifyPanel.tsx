import type { RefObject } from 'react'
import { Button, ButtonRouteLink } from '../../../ui/Button'
import { Field } from '../../../ui/Field'
import { defineMessages, useMessages } from '../../../i18n'
import styles from '../AccessHologram.module.css'

const messages = defineMessages(
  {
    lead: 'reste à votre gauche. Entrez l’e-mail ou l’identifiant rattaché à votre dossier citoyen — inscription ou entrée, le sas décidera.',
    label: 'E-mail ou identifiant',
    hint: 'Ex. habitante@terra-nova.city · ou un identifiant court',
    checking: 'Vérification',
    next: 'Continuer',
    contact: 'Écrire à la mairie',
    staff: 'Accès agent / administration',
  },
  {
    lead: 'stays on your left. Enter the e-mail or identifier linked to your citizen record — sign-up or sign-in, the airlock will decide.',
    label: 'E-mail or identifier',
    hint: 'E.g. resident@terra-nova.city · or a short identifier',
    checking: 'Checking',
    next: 'Continue',
    contact: 'Write to the city hall',
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
  return (
    <div className={`${styles.panel} ${styles.panelEnter}`}>
      <p className={styles.lead}>
        <strong>Nova</strong> {m.lead}
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
        <ButtonRouteLink to="/ville/contact" variant="ghost" small className={styles.staffLink}>
          {m.contact}
        </ButtonRouteLink>
        <ButtonRouteLink to="/agent" variant="ghost" small className={styles.staffLink}>
          {m.staff}
        </ButtonRouteLink>
      </div>
    </div>
  )
}
