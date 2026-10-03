import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { requestLogin } from '../../api/auth'
import { toApiError } from '../../api/errors'
import { isStaffRole, signIn, useSessionUser } from '../../api/session'
import type { User } from '../../api/types'
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
  if (apiError.code === 'INVALID_CREDENTIALS') {
    const remaining = (apiError.details as { remaining_attempts?: number } | undefined)?.remaining_attempts
    if (remaining === 0) return 'E-mail ou mot de passe incorrect. Par sécurité, ce compte est maintenant bloqué temporairement.'
    if (remaining !== undefined && remaining <= 3) {
      return `E-mail ou mot de passe incorrect. Encore ${remaining} essai${remaining > 1 ? 's' : ''} avant un blocage temporaire du compte.`
    }
    return null
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

export default function StaffLoginPage() {
  const persona = usePersona()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const retour = params.get('retour')
  const expired = params.get('expiree') === '1'
  const user = useSessionUser()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [citizen, setCitizen] = useState<User | null>(null)
  const [lockedUntil, setLockedUntil] = useState<number | null>(null)
  const title = persona === 'ADMIN' ? 'Connexion à l’administration' : 'Connexion à l’espace agent'
  useDocumentTitle(title)

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
        const apiError = toApiError(error)
        if (apiError.status === 429 && apiError.retryAfter) setLockedUntil(lockDeadline(apiError.retryAfter))
        throw apiError
      }
    },
    describeError: describeLoginError,
    onSuccess: (auth) => {
      setPassword('')
      if (!isStaffRole(auth.user.role)) {
        setCitizen(auth.user)
        return
      }
      replayBoot()
      clearSessionExpired()
      signIn(auth)
      if (persona === 'ADMIN' && auth.user.role !== 'ADMIN') toast('Administration réservée aux administrateurs : bienvenue dans l’espace agent.', 'info')
      navigate(destinationAfterLogin(auth.user.role, retour), { replace: true })
    },
  })

  // Already signed in as staff: straight to the workspace.
  if (user && isStaffRole(user.role) && !citizen) return <Navigate to={destinationAfterLogin(user.role, retour)} replace />

  const submit = (event: FormEvent) => {
    event.preventDefault()
    void form.handleSubmit({ email, password })
  }

  return (
    <AccessFrame
      space={persona === 'ADMIN' ? 'Administration' : 'Espace agent'}
      title={citizen ? 'Espace réservé au personnel municipal' : title}
      lead={citizen ? undefined : 'Réservé aux agents et administrateurs de Terra Nova. Les habitants se connectent depuis le sas d’entrée.'}
    >
      {citizen ? (
        <CitizenRefused user={citizen} onRetry={() => setCitizen(null)} />
      ) : (
        <form className={styles.form} noValidate onSubmit={submit}>
          {expired && (
            <p className={styles.notice} role="status">
              <Icon name="clock" size={16} />
              <span>Votre session a expiré. Reconnectez-vous pour reprendre là où vous en étiez.</span>
            </p>
          )}
          <ErrorSummary id={form.summaryId} errors={form.summary} formError={form.formError} />
          {lockedUntil !== null && <LockCountdown until={lockedUntil} onDone={() => setLockedUntil(null)} />}
          <Field label={LABELS.email} id={form.fieldId('email')} error={form.errors.email} required>
            {(id, describedBy, invalid) => (
              <TextInput
                id={id}
                type="email"
                autoComplete="username"
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
