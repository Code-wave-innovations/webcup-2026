import { useState } from 'react'
import { Button } from '../../../ui/Button'
import { Field } from '../../../ui/Field'
import { defineMessages, useMessages } from '../../../i18n'
import styles from '../AccessHologram.module.css'

const messages = defineMessages(
  {
    step: 'Étape 2 sur 3',
    password: 'Mot de passe',
    hide: 'Masquer le mot de passe',
    show: 'Afficher le mot de passe',
    confirm: 'Confirmation',
    creating: 'Création',
    submit: 'Créer mon accès',
    back: 'Retour',
  },
  {
    step: 'Step 2 of 3',
    password: 'Password',
    hide: 'Hide the password',
    show: 'Show the password',
    confirm: 'Confirm',
    creating: 'Creating',
    submit: 'Create my access',
    back: 'Back',
  },
)

interface RegisterSecretsPanelProps {
  password: string
  confirm: string
  error: string | null
  reminder: string
  submitting: boolean
  onPasswordChange: (value: string) => void
  onConfirmChange: (value: string) => void
  onBack: () => void
}

export function RegisterSecretsPanel({
  password,
  confirm,
  error,
  reminder,
  submitting,
  onPasswordChange,
  onConfirmChange,
  onBack,
}: RegisterSecretsPanelProps) {
  const m = useMessages(messages)
  const [revealed, setRevealed] = useState(false)

  return (
    <div className={`${styles.panel} ${styles.panelEnter}`}>
      <div className={styles.dots} aria-label={m.step}>
        <i data-active="false" />
        <i data-active="true" />
        <i data-active="false" />
      </div>
      <p className={styles.reminder}>{reminder}</p>
      <Field label={m.password} htmlFor="access-password" error={error}>
        <span className={styles.sight}>
          <input
            id="access-password"
            name="password"
            type={revealed ? 'text' : 'password'}
            autoComplete="new-password"
            value={password}
            readOnly={submitting}
            onChange={(e) => onPasswordChange(e.target.value)}
          />
          <button
            type="button"
            className={styles.reveal}
            aria-controls="access-password"
            aria-pressed={revealed}
            aria-label={revealed ? m.hide : m.show}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setRevealed((v) => !v)}
          >
            <EyeIcon open={revealed} />
          </button>
        </span>
      </Field>
      <Field label={m.confirm} htmlFor="access-password-confirm">
        <span className={styles.sight}>
          <input
            id="access-password-confirm"
            name="password_confirm"
            type={revealed ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirm}
            readOnly={submitting}
            onChange={(e) => onConfirmChange(e.target.value)}
          />
        </span>
      </Field>
      <div className={styles.actions}>
        <Button type="submit" className={styles.submit} disabled={submitting} data-nova-look>
          {submitting ? (
            <>
              <span className={styles.spinner} aria-hidden="true" /> {m.creating}
            </>
          ) : (
            m.submit
          )}
        </Button>
        <Button type="button" variant="ghost" className={styles.back} disabled={submitting} onClick={onBack}>
          {m.back}
        </Button>
      </div>
    </div>
  )
}

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {!open && <path d="M4 4l16 16" />}
    </svg>
  )
}
