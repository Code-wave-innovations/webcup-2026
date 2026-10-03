import type { RefObject } from 'react'
import { Button, ButtonRouteLink } from '../../../ui/Button'
import { Field } from '../../../ui/Field'
import styles from '../AccessHologram.module.css'

interface IdentifyPanelProps {
  identifier: string
  error: string | null
  checking: boolean
  identifierRef: RefObject<HTMLInputElement | null>
  onChange: (value: string) => void
}

export function IdentifyPanel({ identifier, error, checking, identifierRef, onChange }: IdentifyPanelProps) {
  return (
    <div className={`${styles.panel} ${styles.panelEnter}`}>
      <p className={styles.lead}>
        <strong>Nova</strong> reste à votre gauche. Entrez l’e-mail ou l’identifiant rattaché à votre dossier citoyen —
        inscription ou entrée, le sas décidera.
      </p>
      <Field label="E-mail ou identifiant" htmlFor="access-id" error={error}>
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
      <p className={styles.hint}>Ex. habitante@terra-nova.city · ou un identifiant court</p>
      <div className={styles.actions}>
        <Button type="submit" className={styles.submit} disabled={checking} data-nova-look>
          {checking ? (
            <>
              <span className={styles.spinner} aria-hidden="true" /> Vérification
            </>
          ) : (
            'Continuer'
          )}
        </Button>
        <ButtonRouteLink to="/agent" variant="ghost" small className={styles.staffLink}>
          Accès agent / administration
        </ButtonRouteLink>
      </div>
    </div>
  )
}
