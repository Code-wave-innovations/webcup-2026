import type { CSSProperties, KeyboardEvent, RefObject } from 'react'
import { Button } from '../../../ui/Button'
import { Field } from '../../../ui/Field'
import { Icon } from '../../../ui/Icon'
import { defineMessages, useMessages } from '../../../i18n'
import { LOCK_MS, MAX_ATTEMPTS } from '../accessLock'
import type { LoginState } from '../loginMachine'
import styles from '../AccessHologram.module.css'

const messages = defineMessages(
  {
    identifier: 'Identifiant',
    code: "Code d'accès",
    hide: "Masquer le code d'accès",
    show: "Afficher le code d'accès",
    capsLock: 'Majuscules activées',
    triesLeft: (left: number, max: number) => `${left} essai${left > 1 ? 's' : ''} restant${left > 1 ? 's' : ''} sur ${max}`,
    checkingStatus: 'Vérification…',
    lockedStatus: (seconds: number) => `Verrouillé · ${seconds} s`,
    tries: 'Essais',
    lockedButton: (seconds: number) => `Sas verrouillé · ${seconds} s`,
    checking: 'Vérification',
    submit: "Demander l'entrée",
    face: 'Entrer avec mon visage',
    pendingLink: 'Votre visage sera associé au compte qui entre maintenant.',
    forgot: 'Code oublié ? J’ai un code de la mairie',
    back: 'Retour',
  },
  {
    identifier: 'Identifier',
    code: 'Access code',
    hide: 'Hide the access code',
    show: 'Show the access code',
    capsLock: 'Caps Lock is on',
    triesLeft: (left, max) => `${left} of ${max} tries left`,
    checkingStatus: 'Checking…',
    lockedStatus: (seconds) => `Locked · ${seconds} s`,
    tries: 'Tries',
    lockedButton: (seconds) => `Airlock locked · ${seconds} s`,
    checking: 'Checking',
    submit: 'Request entry',
    face: 'Sign in with my face',
    pendingLink: 'Your face will be linked to the account signing in now.',
    forgot: 'Forgot your code? I have a code from the city hall',
    back: 'Back',
  },
)

interface LoginPanelProps {
  identifier: string
  code: string
  state: LoginState
  secondsLeft: number
  error: string | null
  codeRef: RefObject<HTMLInputElement | null>
  codeSightRef: RefObject<HTMLSpanElement | null>
  capsLock: boolean
  revealed: boolean
  pendingFaceLink: boolean
  onCodeChange: (value: string) => void
  onToggleReveal: () => void
  onCaps: (event: KeyboardEvent<HTMLInputElement>) => void
  /** absent in the light version (F96): no face login */
  onFace?: () => void
  onForgot: () => void
  onBack: () => void
}

export function LoginPanel({
  identifier,
  code,
  state,
  secondsLeft,
  error,
  codeRef,
  codeSightRef,
  capsLock,
  revealed,
  pendingFaceLink,
  onCodeChange,
  onToggleReveal,
  onCaps,
  onFace,
  onForgot,
  onBack,
}: LoginPanelProps) {
  const m = useMessages(messages)
  const checking = state.status === 'checking'
  const locked = state.status === 'locked'

  return (
    <div className={`${styles.panel} ${styles.panelEnter}`}>
      <div>
        <span className={styles.identifierChip} aria-label={m.identifier}>{identifier}</span>
      </div>

      <Field label={m.code} htmlFor="access-code">
        <span ref={codeSightRef} className={styles.sight}>
          <input
            ref={codeRef}
            id="access-code"
            name="code"
            type={revealed ? 'text' : 'password'}
            autoComplete="current-password"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="TN-0000"
            value={code}
            readOnly={checking}
            aria-describedby={capsLock ? 'access-caps' : undefined}
            onChange={(e) => onCodeChange(e.target.value)}
            onKeyDown={onCaps}
            onKeyUp={onCaps}
          />
          <button
            type="button"
            className={styles.reveal}
            aria-controls="access-code"
            aria-pressed={revealed}
            aria-label={revealed ? m.hide : m.show}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onToggleReveal}
          >
            <EyeIcon open={revealed} />
          </button>
        </span>
      </Field>
      {capsLock && (
        <p id="access-caps" className={styles.caps}>
          <Icon name="alert" size={14} /> {m.capsLock}
        </p>
      )}

      <div className={styles.status}>
        <span className={styles.pips} role="img" aria-label={m.triesLeft(MAX_ATTEMPTS - state.strikes, MAX_ATTEMPTS)}>
          {Array.from({ length: MAX_ATTEMPTS }, (_, i) => (
            <i key={i} data-used={i < state.strikes} />
          ))}
        </span>
        <span className={styles.statusText}>{checking ? m.checkingStatus : locked ? m.lockedStatus(secondsLeft) : m.tries}</span>
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.actions}>
        <Button type="submit" className={styles.submit} disabled={locked} data-nova-look>
          {locked ? (
            <>
              <LockRing key={state.lock.lockedUntil} /> {m.lockedButton(secondsLeft)}
            </>
          ) : checking ? (
            <>
              <span className={styles.spinner} aria-hidden="true" /> {m.checking}
            </>
          ) : (
            m.submit
          )}
        </Button>
        {onFace && (
          <Button type="button" variant="ghost" className={styles.faceButton} disabled={checking || locked} onClick={onFace}>
            <Icon name="face" size={20} /> {m.face}
          </Button>
        )}
        {pendingFaceLink && (
          <p className={styles.linkHint}>
            <Icon name="face" size={14} /> {m.pendingLink}
          </p>
        )}
        {/* F34: forgotten code, or a lock that will not wait: the city checks who you are and gives you a code */}
        <button type="button" className={styles.forgot} disabled={checking} onClick={onForgot}>
          {m.forgot}
        </button>
        <Button type="button" variant="ghost" className={styles.back} disabled={checking} onClick={onBack}>
          {m.back}
        </Button>
      </div>
    </div>
  )
}

function LockRing() {
  return (
    <svg className={styles.ring} width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" style={{ '--lock-ms': `${LOCK_MS}ms` } as CSSProperties}>
      <circle cx="10" cy="10" r="8" pathLength={1} />
      <circle cx="10" cy="10" r="8" pathLength={1} />
    </svg>
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
