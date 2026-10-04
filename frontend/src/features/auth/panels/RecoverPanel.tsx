import { useState } from 'react'
import { Button } from '../../../ui/Button'
import { Field } from '../../../ui/Field'
import { Icon } from '../../../ui/Icon'
import styles from '../AccessHologram.module.css'

interface RecoverPanelProps {
  identifier: string
  code: string
  password: string
  confirm: string
  error: { field?: 'code' | 'password' | 'confirm'; message: string } | null
  submitting: boolean
  onCodeChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onConfirmChange: (value: string) => void
  onBack: () => void
}

/**
 * F34: forgotten access code. The city checks the person's identity (ID at the counter, or questions
 * on the phone) and hands over a one-time code; here the person types it and chooses a new access code
 * that nobody else ever sees. Their other devices are signed out.
 */
export function RecoverPanel({ identifier, code, password, confirm, error, submitting, onCodeChange, onPasswordChange, onConfirmChange, onBack }: RecoverPanelProps) {
  const [revealed, setRevealed] = useState(false)
  const fieldError = (field: 'code' | 'password' | 'confirm') => (error?.field === field ? error.message : null)

  return (
    <div className={`${styles.panel} ${styles.panelEnter}`}>
      <div>
        <span className={styles.identifierChip} aria-label="Identifiant">
          {identifier}
        </span>
      </div>

      <div className={styles.recoverInfo}>
        <Icon name="hex" size={16} />
        <p>
          <strong>Pas encore de code ?</strong> Présentez-vous au guichet de la mairie avec une pièce d’identité, ou appelez-la : un agent vérifie que c’est bien vous et vous remet un
          code valable 30 minutes. Personne d’autre que vous ne connaîtra votre nouveau code d’accès.
        </p>
      </div>

      <Field label="Code remis par la mairie" htmlFor="recover-code" error={fieldError('code')}>
        <span className={styles.sight}>
          <input
            id="recover-code"
            name="reset_code"
            autoComplete="one-time-code"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="XXXX-XXXX"
            maxLength={20}
            value={code}
            readOnly={submitting}
            onChange={(e) => onCodeChange(e.target.value)}
          />
        </span>
      </Field>
      <Field label="Nouveau code d’accès" htmlFor="recover-password" hint="8 caractères au moins." error={fieldError('password')}>
        <span className={styles.sight}>
          <input
            id="recover-password"
            name="new_password"
            type={revealed ? 'text' : 'password'}
            autoComplete="new-password"
            value={password}
            readOnly={submitting}
            onChange={(e) => onPasswordChange(e.target.value)}
          />
          <button
            type="button"
            className={styles.reveal}
            aria-controls="recover-password"
            aria-pressed={revealed}
            aria-label={revealed ? 'Masquer le code d’accès' : 'Afficher le code d’accès'}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setRevealed((v) => !v)}
          >
            <EyeIcon open={revealed} />
          </button>
        </span>
      </Field>
      <Field label="Confirmation" htmlFor="recover-confirm" error={fieldError('confirm')}>
        <span className={styles.sight}>
          <input
            id="recover-confirm"
            name="new_password_confirm"
            type={revealed ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirm}
            readOnly={submitting}
            onChange={(e) => onConfirmChange(e.target.value)}
          />
        </span>
      </Field>

      {error && !error.field && (
        <p className={styles.error} role="alert">
          {error.message}
        </p>
      )}

      <div className={styles.actions}>
        <Button type="submit" className={styles.submit} disabled={submitting} data-nova-look>
          {submitting ? (
            <>
              <span className={styles.spinner} aria-hidden="true" /> Vérification
            </>
          ) : (
            'Valider mon nouveau code'
          )}
        </Button>
        <Button type="button" variant="ghost" className={styles.back} disabled={submitting} onClick={onBack}>
          Retour
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
