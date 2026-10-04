import type { CSSProperties, KeyboardEvent, RefObject } from 'react'
import { Button } from '../../../ui/Button'
import { Field } from '../../../ui/Field'
import { Icon } from '../../../ui/Icon'
import { LOCK_MS, MAX_ATTEMPTS } from '../accessLock'
import type { LoginState } from '../loginMachine'
import styles from '../AccessHologram.module.css'

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
  onBack,
}: LoginPanelProps) {
  const checking = state.status === 'checking'
  const locked = state.status === 'locked'

  return (
    <div className={`${styles.panel} ${styles.panelEnter}`}>
      <div>
        <span className={styles.identifierChip} aria-label="Identifiant">{identifier}</span>
      </div>

      <Field label="Code d'accès" htmlFor="access-code">
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
            aria-label={revealed ? "Masquer le code d'accès" : "Afficher le code d'accès"}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onToggleReveal}
          >
            <EyeIcon open={revealed} />
          </button>
        </span>
      </Field>
      {capsLock && (
        <p id="access-caps" className={styles.caps}>
          <Icon name="alert" size={14} /> Majuscules activées
        </p>
      )}

      <div className={styles.status}>
        <span className={styles.pips} role="img" aria-label={`${MAX_ATTEMPTS - state.strikes} essais restants sur ${MAX_ATTEMPTS}`}>
          {Array.from({ length: MAX_ATTEMPTS }, (_, i) => (
            <i key={i} data-used={i < state.strikes} />
          ))}
        </span>
        <span className={styles.statusText}>{checking ? 'Vérification…' : locked ? `Verrouillé · ${secondsLeft} s` : 'Essais'}</span>
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
              <LockRing key={state.lock.lockedUntil} /> Sas verrouillé · {secondsLeft} s
            </>
          ) : checking ? (
            <>
              <span className={styles.spinner} aria-hidden="true" /> Vérification
            </>
          ) : (
            "Demander l'entrée"
          )}
        </Button>
        {onFace && (
          <Button type="button" variant="ghost" className={styles.faceButton} disabled={checking || locked} onClick={onFace}>
            <Icon name="face" size={20} /> Entrer avec mon visage
          </Button>
        )}
        {pendingFaceLink && (
          <p className={styles.linkHint}>
            <Icon name="face" size={14} /> Votre visage sera associé au compte qui entre maintenant.
          </p>
        )}
        <Button type="button" variant="ghost" className={styles.back} disabled={checking} onClick={onBack}>
          Retour
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
