import { useState, type FormEvent } from 'react'
import { login } from '../api/auth'
import { signOut, useSessionUser } from '../api/session'
import { Button } from '../ui/Button'
import { ErrorSummary } from '../ui/ErrorSummary'
import { Field } from '../ui/Field'
import { useApiForm } from '../hooks/useApiForm'
import styles from './DevLogin.module.css'

/*
  Development only (imported behind import.meta.env.DEV): signs in with the seed's demo accounts
  until the real login screens arrive (PLAN-01). Also exercises the accessible form primitives.
*/

const SEED_PASSWORD = 'NovaTerra2026!'
const ACCOUNTS = [
  { email: 'admin@novaterra.local', label: 'Ada · admin' },
  { email: 'agent@novaterra.local', label: 'Alex · agent' },
  { email: 'citoyen@novaterra.local', label: 'Lucas · citoyen' },
]
const LABELS = { email: 'Adresse e-mail', password: 'Mot de passe' }

export function DevLogin() {
  const user = useSessionUser()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const form = useApiForm({
    labels: LABELS,
    submit: (values: { email: string; password: string }) => login(values.email, values.password),
    validate: (values) => {
      const errors: Record<string, string> = {}
      if (!values.email.trim()) errors.email = 'Saisissez une adresse e-mail.'
      if (!values.password) errors.password = 'Saisissez le mot de passe.'
      return errors
    },
  })

  if (user) {
    return (
      <div className={styles.box}>
        <p>
          Connecté·e : <strong>{user.name} {user.last_name}</strong> ({user.role}, {user.email})
        </p>
        <Button small variant="ghost" onClick={signOut}>
          Se déconnecter
        </Button>
      </div>
    )
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    void form.handleSubmit({ email, password })
  }

  return (
    <form className={styles.box} noValidate onSubmit={submit}>
      <ErrorSummary id={form.summaryId} errors={form.summary} formError={form.formError} />
      <Field label={LABELS.email} htmlFor={form.fieldId('email')} required error={form.errors.email}>
        {(control) => (
          <input
            {...control}
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              form.clearError('email')
            }}
          />
        )}
      </Field>
      <Field label={LABELS.password} htmlFor={form.fieldId('password')} required error={form.errors.password}>
        {(control) => (
          <input
            {...control}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              form.clearError('password')
            }}
          />
        )}
      </Field>
      <div className={styles.row}>
        <Button type="submit" small disabled={form.pending}>
          {form.pending ? 'Connexion…' : 'Se connecter'}
        </Button>
        {ACCOUNTS.map((account) => (
          <Button
            key={account.email}
            small
            variant="ghost"
            onClick={() => {
              setEmail(account.email)
              setPassword(SEED_PASSWORD)
            }}
          >
            {account.label}
          </Button>
        ))}
      </div>
    </form>
  )
}
