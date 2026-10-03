import { useRef, useState, type FormEvent, type Ref } from 'react'
import { Button } from '../../ui/Button'
import { Field } from '../../ui/Field'
import { NovaMark } from '../../ui/Icon'
import text from '../../ui/text.module.css'
import { lockSecondsLeft, OPEN_LOCK, registerFailure, type AccessLock } from './accessLock'
import { demoAuthService, type Session } from './authService'
import { DEMO_ACCOUNTS, type DemoAccountId } from './demoAccounts'
import styles from './AccessHologram.module.css'

interface AccessHologramProps {
  /** folds the hologram into a line once access is granted */
  collapsed: boolean
  onGranted: (session: Session) => void
  formRef?: Ref<HTMLFormElement>
}

const DEMO_BUTTONS: ReadonlyArray<readonly [DemoAccountId, string]> = [
  ['miora', 'Habitante, Miora'],
  ['conseil', 'Haut Conseil, Koto'],
]

/** Access control of Terra Nova: identifier and access code, demo accounts, lock after five refusals. */
export function AccessHologram({ collapsed, onGranted, formRef }: AccessHologramProps) {
  const [identifier, setIdentifier] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [granted, setGranted] = useState<Session | null>(null)
  const lock = useRef<AccessLock>(OPEN_LOCK)
  const identifierRef = useRef<HTMLInputElement>(null)
  const codeRef = useRef<HTMLInputElement>(null)
  const submitRef = useRef<HTMLButtonElement>(null)

  const fillDemoAccount = (id: DemoAccountId) => {
    setIdentifier(id)
    setCode(DEMO_ACCOUNTS[id].code)
    setError(null)
    submitRef.current?.focus()
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (granted) return
    const now = Date.now()
    const wait = lockSecondsLeft(lock.current, now)
    if (wait > 0) return setError(`Trop de tentatives. Nouvel essai possible dans ${wait} s.`)
    if (!identifier.trim() || !code.trim()) {
      setError("Saisissez votre identifiant et votre code d'accès.")
      ;(identifier.trim() ? codeRef : identifierRef).current?.focus()
      return
    }
    const result = await demoAuthService.signIn(identifier, code)
    if (!result.ok) {
      const failure = registerFailure(lock.current, now)
      lock.current = failure.lock
      setError(
        failure.lockedNow
          ? 'Accès refusé cinq fois. Le sas est verrouillé pendant 30 s.'
          : `Identifiant ou code refusé. Tentative ${failure.attempt} sur 5.`,
      )
      codeRef.current?.focus()
      codeRef.current?.select()
      return
    }
    lock.current = OPEN_LOCK
    setGranted(result.session)
    onGranted(result.session)
  }

  return (
    <form ref={formRef} className={[styles.holo, collapsed && styles.collapsed].filter(Boolean).join(' ')} noValidate onSubmit={submit}>
      {granted ? (
        <div className={styles.granted} role="status">
          <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 2 20.7 7v10L12 22 3.3 17V7z" />
            <path d="m8.5 12 2.5 2.5 4.5-5" />
          </svg>
          <b>Accès autorisé</b>
          <p>Bienvenue, {granted.name}. Couloir d'entrée verrouillé.</p>
        </div>
      ) : (
        <>
          <div className={styles.header}>
            <NovaMark size={34} stroke={1.6} />
            <div>
              <h1 className={styles.title} id="airlock-title">
                Contrôle d'accès de Terra Nova
              </h1>
              <p className={styles.subtitle}>Identifiez-vous pour entrer dans l'atmosphère.</p>
            </div>
          </div>
          <Field label="Identifiant" htmlFor="access-id">
            <input
              ref={identifierRef}
              id="access-id"
              name="identifier"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="miora"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
          </Field>
          <Field label="Code d'accès" htmlFor="access-code">
            <input
              ref={codeRef}
              id="access-code"
              name="code"
              type="password"
              autoComplete="current-password"
              placeholder="Votre code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </Field>
          {error && (
            <p className={text.error} role="alert">
              {error}
            </p>
          )}
          <Button ref={submitRef} type="submit">
            Demander l'entrée
          </Button>
          <div className={styles.accounts}>
            <span>Comptes de démonstration</span>
            {DEMO_BUTTONS.map(([id, label]) => (
              <button key={id} type="button" onClick={() => fillDemoAccount(id)}>
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </form>
  )
}
