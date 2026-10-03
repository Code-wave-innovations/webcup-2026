import { Button } from '../../../ui/Button'
import { Field } from '../../../ui/Field'
import styles from '../AccessHologram.module.css'

interface RegisterIdentityPanelProps {
  name: string
  lastName: string
  error: string | null
  reminder: string
  onNameChange: (value: string) => void
  onLastNameChange: (value: string) => void
  onBack: () => void
}

export function RegisterIdentityPanel({
  name,
  lastName,
  error,
  reminder,
  onNameChange,
  onLastNameChange,
  onBack,
}: RegisterIdentityPanelProps) {
  return (
    <div className={`${styles.panel} ${styles.panelEnter}`}>
      <div className={styles.dots} aria-label="Étape 1 sur 3">
        <i data-active="true" />
        <i data-active="false" />
        <i data-active="false" />
      </div>
      <p className={styles.reminder}>{reminder}</p>
      <Field label="Prénom" htmlFor="access-name" error={error}>
        <input
          id="access-name"
          name="name"
          autoComplete="given-name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
        />
      </Field>
      <Field label="Nom" htmlFor="access-last-name">
        <input
          id="access-last-name"
          name="last_name"
          autoComplete="family-name"
          value={lastName}
          onChange={(e) => onLastNameChange(e.target.value)}
        />
      </Field>
      <div className={styles.actions}>
        <Button type="submit" className={styles.submit} data-nova-look>
          Suivant
        </Button>
        <Button type="button" variant="ghost" className={styles.back} onClick={onBack}>
          Retour
        </Button>
      </div>
    </div>
  )
}
