import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import {
  finishEnforcedSetup,
  isSession,
  loginWithPasskey,
  passkeysSupported,
  requestLogin,
  startEnforcedSetup,
  verifyTwoFactor,
} from '../../api/auth'
import { messageFor, toApiError } from '../../api/errors'
import { isStaffRole, signIn, useStaffUser } from '../../api/session'
import type { AuthResponse, LoginStep, TwoFactorSetup, User } from '../../api/types'
import { useApiForm } from '../../hooks/useApiForm'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useNow } from '../lib/useNow'
import { toast } from '../stores/toastStore'
import { Button, ButtonLink } from '../ui/Button'
import { Field, TextInput } from '../ui/Controls'
import { ErrorSummary } from '../ui/ErrorSummary'
import { Icon } from '../ui/Icon'
import { AccessFrame } from './AccessFrame'
import { replayBoot } from './boot'
import { destinationAfterLogin, usePersona } from './persona'
import { clearSessionExpired } from './sessionNotice'
import styles from './Access.module.css'

/*
  D08 / D09: the staff sign in here with the same account API as residents; the role decides the space.
  F37: attempts left and lockouts are spelled out, with a countdown.
*/

interface Credentials {
  email: string
  password: string
}

const LABELS = { email: 'Adresse e-mail professionnelle', password: 'Mot de passe' }

/** Seed accounts, offered in development only. */
const DEMO_PASSWORD = 'NovaTerra2026!'
const DEMO_ACCOUNTS = [
  { email: 'agent@novaterra.local', label: 'Alex · agent' },
  { email: 'admin@novaterra.local', label: 'Ada · admin' },
]

/** F37: says more than "wrong password" when the server tells how close the account is to a lockout. */
function describeLoginError(error: unknown): string | null {
  const apiError = toApiError(error)
  if (apiError.code === 'INVALID_CREDENTIALS' || apiError.code === 'INVALID_TWO_FACTOR_CODE') {
    const what = apiError.code === 'INVALID_TWO_FACTOR_CODE' ? 'Code de vérification incorrect.' : 'E-mail ou mot de passe incorrect.'
    const remaining = (apiError.details as { remaining_attempts?: number } | undefined)?.remaining_attempts
    if (remaining === 0) return `${what} Par sécurité, ce compte est maintenant bloqué temporairement.`
    if (remaining !== undefined && remaining <= 3) {
      return `${what} Encore ${remaining} essai${remaining > 1 ? 's' : ''} avant un blocage temporaire du compte.`
    }
    return apiError.code === 'INVALID_TWO_FACTOR_CODE' ? what : null
  }
  // the login answers 403 only for a deactivated account
  if (apiError.status === 403) return 'Ce compte est désactivé. Contactez un administrateur de la plateforme.'
  if (apiError.code === 'ACCOUNT_LOCKED') return 'Trop de tentatives : ce compte est bloqué temporairement.'
  if (apiError.code === 'IP_BLOCKED') return 'Trop de tentatives depuis cette connexion : elle est bloquée temporairement.'
  return null
}

/** When the next attempt is allowed; called from the submit handler, after the server answered 429. */
const lockDeadline = (retryAfterSeconds: number) => Date.now() + retryAfterSeconds * 1000

const formatWait = (ms: number) => {
  const seconds = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, '0')} s`
}

/** F37: the time left before the next attempt; tells the form when it may submit again. */
function LockCountdown({ until, onDone }: { until: number; onDone: () => void }) {
  const now = useNow()
  const left = until - now
  useEffect(() => {
    if (left <= 0) onDone()
  }, [left, onDone])
  return (
    <p className={styles.notice} role="status">
      <Icon name="lock" size={16} />
      <span>
        Nouvel essai possible dans <span className={styles.countdown}>{formatWait(left)}</span>.
      </span>
    </p>
  )
}

/** A resident signed in here: the back-office stays closed, and the session is not opened. */
function CitizenRefused({ user, onRetry }: { user: User; onRetry: () => void }) {
  return (
    <div className={styles.form}>
      <p className={styles.notice} role="alert">
        <Icon name="shield" size={16} />
        <span>
          <strong>{user.email}</strong> est un compte d’habitant. Cet espace est réservé au personnel municipal.
        </span>
      </p>
      <div className={styles.actions}>
        <ButtonLink to="/" variant="primary" icon="globe">
          Aller au sas d’entrée des habitants
        </ButtonLink>
        <Button onClick={onRetry}>Utiliser un autre compte</Button>
      </div>
    </div>
  )
}

/** Where the sign-in stands: identifiers, then a code (F53) or the enforced setup of the second factor */
type Step =
  | { kind: 'credentials' }
  | { kind: 'code'; challenge: string }
  | { kind: 'setup'; setupToken: string }
  | { kind: 'recovery'; auth: AuthResponse; codes: string[] }

export default function StaffLoginPage() {
  const persona = usePersona()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const retour = params.get('retour')
  const ended = params.get('expiree')
  const staff = useStaffUser()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [citizen, setCitizen] = useState<User | null>(null)
  const [lockedUntil, setLockedUntil] = useState<number | null>(null)
  const [step, setStep] = useState<Step>({ kind: 'credentials' })
  const [stepNotice, setStepNotice] = useState<string | null>(null)
  const title = persona === 'ADMIN' ? 'Connexion à l’administration' : 'Connexion à l’espace agent'
  useDocumentTitle(title)

  /** The server answered 429: the countdown starts; the error goes on to the form */
  const watchLock = (error: unknown) => {
    const apiError = toApiError(error)
    if (apiError.status === 429 && apiError.retryAfter) setLockedUntil(lockDeadline(apiError.retryAfter))
    // a step token that expired: back to the start
    if (apiError.code === 'INVALID_STEP_TOKEN') {
      setStep({ kind: 'credentials' })
      setStepNotice('Le délai de cette étape est dépassé : reconnectez-vous.')
    }
    return apiError
  }

  /** Opens the session, unless the account is a resident's */
  const finish = (auth: AuthResponse) => {
    setPassword('')
    if (!isStaffRole(auth.user.role)) {
      setCitizen(auth.user)
      setStep({ kind: 'credentials' })
      return
    }
    replayBoot()
    clearSessionExpired()
    signIn(auth)
    if (auth.security?.new_device) toast('Connexion depuis un nouvel appareil : il a été ajouté à « Mon compte ».', 'info')
    if (persona === 'ADMIN' && auth.user.role !== 'ADMIN') toast('Administration réservée aux administrateurs : bienvenue dans l’espace agent.', 'info')
    navigate(destinationAfterLogin(auth.user.role, retour), { replace: true })
  }

  const next = (result: LoginStep) => {
    setStepNotice(null)
    if (isSession(result)) return result.recovery_codes?.length ? setStep({ kind: 'recovery', auth: result, codes: result.recovery_codes }) : finish(result)
    if ('two_factor_required' in result) return setStep({ kind: 'code', challenge: result.challenge_token })
    setStep({ kind: 'setup', setupToken: result.setup_token })
  }

  const form = useApiForm({
    labels: LABELS,
    validate: (values: Credentials) => {
      const errors: Record<string, string> = {}
      if (!values.email.trim()) errors.email = 'Saisissez votre adresse e-mail.'
      if (!values.password) errors.password = 'Saisissez votre mot de passe.'
      return errors
    },
    submit: async (values: Credentials) => {
      try {
        return await requestLogin(values.email.trim(), values.password)
      } catch (error) {
        throw watchLock(error)
      }
    },
    describeError: describeLoginError,
    onSuccess: next,
  })

  const [passkeyPending, setPasskeyPending] = useState(false)
  const signInWithPasskey = async () => {
    setPasskeyPending(true)
    setStepNotice(null)
    try {
      next(await loginWithPasskey(email.trim() || undefined))
    } catch (error) {
      const name = error instanceof Error ? error.name : ''
      setStepNotice(name === 'NotAllowedError' || name === 'AbortError' ? 'Connexion par clé d’accès annulée.' : (describeLoginError(error) ?? messageFor(error)))
    } finally {
      setPasskeyPending(false)
    }
  }

  // Already signed in as staff: straight to the workspace they opened (ignores a leftover CITIZEN JWT).
  if (staff && !citizen) return <Navigate to={destinationAfterLogin(staff.role, retour)} replace />

  const submit = (event: FormEvent) => {
    event.preventDefault()
    void form.handleSubmit({ email, password })
  }

  return (
    <AccessFrame
      space={persona === 'ADMIN' ? 'Administration' : 'Espace agent'}
      title={citizen ? 'Espace réservé au personnel municipal' : step.kind === 'code' ? 'Double vérification' : step.kind === 'setup' || step.kind === 'recovery' ? 'Activer la double vérification' : title}
      lead={citizen ? undefined : step.kind === 'credentials' ? 'Réservé aux agents et administrateurs de Terra Nova. Les habitants se connectent depuis le sas d’entrée.' : undefined}
    >
      {citizen ? (
        <CitizenRefused user={citizen} onRetry={() => setCitizen(null)} />
      ) : step.kind === 'code' ? (
        <CodeStep challenge={step.challenge} lockedUntil={lockedUntil} onLockDone={() => setLockedUntil(null)} watchLock={watchLock} onDone={next} onCancel={() => setStep({ kind: 'credentials' })} />
      ) : step.kind === 'setup' ? (
        <SetupStep setupToken={step.setupToken} watchLock={watchLock} onDone={next} onRestart={() => setStep({ kind: 'credentials' })} />
      ) : step.kind === 'recovery' ? (
        <RecoveryCodes codes={step.codes} onDone={() => finish(step.auth)} />
      ) : (
        <form className={styles.form} noValidate onSubmit={submit}>
          {ended && (
            <p className={styles.notice} role="status">
              <Icon name="clock" size={16} />
              <span>
                {ended === 'revoquee'
                  ? 'Session révoquée : tous les appareils de ce compte ont été déconnectés. Reconnectez-vous.'
                  : 'Votre session a expiré. Reconnectez-vous pour reprendre là où vous en étiez.'}
              </span>
            </p>
          )}
          {stepNotice && (
            <p className={styles.notice} role="alert">
              <Icon name="alert" size={16} />
              <span>{stepNotice}</span>
            </p>
          )}
          <ErrorSummary id={form.summaryId} errors={form.summary} formError={form.formError} />
          {lockedUntil !== null && <LockCountdown until={lockedUntil} onDone={() => setLockedUntil(null)} />}
          <Field label={LABELS.email} id={form.fieldId('email')} error={form.errors.email} required>
            {(id, describedBy, invalid) => (
              <TextInput
                id={id}
                type="email"
                autoComplete="username webauthn"
                inputMode="email"
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  form.clearError('email')
                }}
              />
            )}
          </Field>
          <Field label={LABELS.password} id={form.fieldId('password')} error={form.errors.password} required>
            {(id, describedBy, invalid) => (
              <TextInput
                id={id}
                type="password"
                autoComplete="current-password"
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  form.clearError('password')
                }}
              />
            )}
          </Field>
          <div className={styles.actions}>
            <Button type="submit" variant="primary" icon="key" disabled={form.pending || lockedUntil !== null}>
              {form.pending ? 'Connexion…' : 'Se connecter'}
            </Button>
            {passkeysSupported() && (
              <Button icon="lock" onClick={() => void signInWithPasskey()} disabled={passkeyPending || lockedUntil !== null} aria-busy={passkeyPending}>
                {passkeyPending ? 'Clé d’accès…' : 'Se connecter avec une clé d’accès'}
              </Button>
            )}
          </div>
          {import.meta.env.DEV && (
            <div className={styles.demo}>
              <p>Développement : comptes du seed</p>
              <div className={styles.actions}>
                {DEMO_ACCOUNTS.map((account) => (
                  <Button
                    key={account.email}
                    size="sm"
                    variant="subtle"
                    onClick={() => {
                      setEmail(account.email)
                      setPassword(DEMO_PASSWORD)
                    }}
                  >
                    {account.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </form>
      )}
    </AccessFrame>
  )
}

/** F53: the 6-digit code from the authenticator app, or a single-use recovery code */
function CodeStep({
  challenge,
  lockedUntil,
  onLockDone,
  watchLock,
  onDone,
  onCancel,
}: {
  challenge: string
  lockedUntil: number | null
  onLockDone: () => void
  watchLock: (error: unknown) => unknown
  onDone: (step: LoginStep) => void
  onCancel: () => void
}) {
  const [recovery, setRecovery] = useState(false)
  const [code, setCode] = useState('')
  const form = useApiForm({
    labels: { code: recovery ? 'Code de secours' : 'Code de vérification' },
    validate: (): Record<string, string> =>
      recovery ? (code.trim().length < 6 ? { code: 'Saisissez un de vos codes de secours.' } : {}) : /^\d{6}$/.test(code.replace(/\s/g, '')) ? {} : { code: 'Saisissez les 6 chiffres affichés par votre application.' },
    submit: async () => {
      try {
        return await verifyTwoFactor(challenge, recovery ? { recovery_code: code.trim() } : { code: code.replace(/\s/g, '') })
      } catch (error) {
        throw watchLock(error)
      }
    },
    describeError: describeLoginError,
    onSuccess: onDone,
  })
  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit(undefined)
      }}
    >
      <p>{recovery ? 'Saisissez un code de secours : chacun ne sert qu’une fois.' : 'Ouvrez votre application d’authentification et saisissez le code à 6 chiffres affiché pour Nova Terra.'}</p>
      <ErrorSummary id={form.summaryId} errors={form.summary} formError={form.formError} />
      {lockedUntil !== null && <LockCountdown until={lockedUntil} onDone={onLockDone} />}
      <Field label={recovery ? 'Code de secours' : 'Code de vérification'} id={form.fieldId('code')} error={form.errors.code} required>
        {(id, describedBy, invalid) => (
          <TextInput
            id={id}
            data-autofocus
            autoFocus
            inputMode={recovery ? 'text' : 'numeric'}
            autoComplete="one-time-code"
            pattern={recovery ? undefined : '[0-9]*'}
            maxLength={recovery ? 20 : 7}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            value={code}
            onChange={(e) => {
              setCode(e.target.value)
              form.clearError('code')
            }}
          />
        )}
      </Field>
      <div className={styles.actions}>
        <Button type="submit" variant="primary" icon="check" disabled={form.pending || lockedUntil !== null}>
          {form.pending ? 'Vérification…' : 'Valider'}
        </Button>
        <Button
          variant="subtle"
          onClick={() => {
            setRecovery(!recovery)
            setCode('')
          }}
        >
          {recovery ? 'Utiliser le code de l’application' : 'Utiliser un code de secours'}
        </Button>
        <Button variant="subtle" onClick={onCancel}>
          Retour
        </Button>
      </div>
    </form>
  )
}

/** F53: the policy requires a second factor that this account does not have yet */
function SetupStep({
  setupToken,
  watchLock,
  onDone,
  onRestart,
}: {
  setupToken: string
  watchLock: (error: unknown) => unknown
  onDone: (step: LoginStep) => void
  onRestart: () => void
}) {
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [code, setCode] = useState('')
  // one secret per setup token: the effect only depends on the token
  useEffect(() => {
    let alive = true
    startEnforcedSetup(setupToken).then(
      (payload) => alive && setSetup(payload),
      (error) => alive && setLoadError(messageFor(error)),
    )
    return () => {
      alive = false
    }
  }, [setupToken])
  const form = useApiForm({
    labels: { code: 'Code de vérification' },
    validate: (): Record<string, string> => (/^\d{6}$/.test(code.replace(/\s/g, '')) ? {} : { code: 'Saisissez les 6 chiffres affichés par votre application.' }),
    submit: async () => {
      try {
        return await finishEnforcedSetup(setupToken, code.replace(/\s/g, ''))
      } catch (error) {
        throw watchLock(error)
      }
    },
    onSuccess: onDone,
  })
  if (loadError)
    return (
      <div className={styles.form}>
        <p className={styles.notice} role="alert">
          {loadError}
        </p>
        <Button onClick={onRestart}>Recommencer la connexion</Button>
      </div>
    )
  if (!setup) return <p className={styles.notice}>Préparation de la double vérification…</p>
  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit(undefined)
      }}
    >
      <p>La politique de sécurité impose la double vérification à votre rôle. Scannez ce QR code avec une application d’authentification (Google Authenticator, Microsoft Authenticator, 1Password…).</p>
      <img src={setup.qr_data_url} alt="QR code à scanner avec votre application d’authentification" width={200} height={200} className={styles.qr} />
      <p className={styles.secret}>
        Saisie manuelle : <code>{setup.secret.replace(/(.{4})/g, '$1 ').trim()}</code>
      </p>
      <ErrorSummary id={form.summaryId} errors={form.summary} formError={form.formError} />
      <Field label="Code affiché par l’application" id={form.fieldId('code')} error={form.errors.code} required>
        {(id, describedBy, invalid) => (
          <TextInput id={id} inputMode="numeric" autoComplete="one-time-code" maxLength={7} aria-describedby={describedBy} aria-invalid={invalid || undefined} value={code} onChange={(e) => setCode(e.target.value)} />
        )}
      </Field>
      <div className={styles.actions}>
        <Button type="submit" variant="primary" icon="check" disabled={form.pending}>
          {form.pending ? 'Activation…' : 'Activer et me connecter'}
        </Button>
      </div>
    </form>
  )
}

/** F53: the recovery codes, shown once */
function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  return (
    <div className={styles.form}>
      <p role="status">Double vérification activée. Notez ces codes de secours : chacun permet une connexion si vous perdez votre téléphone. Ils ne seront plus affichés.</p>
      <ul className={styles.codes}>
        {codes.map((c) => (
          <li key={c}>
            <code>{c}</code>
          </li>
        ))}
      </ul>
      <div className={styles.actions}>
        <Button
          icon="file"
          onClick={() =>
            navigator.clipboard.writeText(codes.join('\n')).then(
              () => toast('Codes copiés', 'info'),
              () => toast('Copie impossible : recopiez-les à la main', 'alert'),
            )
          }
        >
          Copier les codes
        </Button>
        <Button variant="primary" icon="check" onClick={onDone}>
          J’ai noté mes codes
        </Button>
      </div>
    </div>
  )
}
