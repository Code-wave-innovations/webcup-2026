import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { useDistricts } from '../../api/districts'
import { messageFor, toApiError } from '../../api/errors'
import { useDeleteMyAccount, useMe, useUpdateMe } from '../../api/me'
import { signOutCitizen, useCitizenUser } from '../../api/session'
import type { User } from '../../api/types'
import { rewindToCockpit } from '../../app/airlock'
import { useAuthStore } from '../../features/auth/authStore'
import { useApiForm } from '../../hooks/useApiForm'
import { Button } from '../../ui/Button'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import { ErrorSummary } from '../../ui/ErrorSummary'
import { Field } from '../../ui/Field'
import { GlassPanel } from '../../ui/GlassPanel'
import text from '../../ui/text.module.css'
import { announce } from '../../ui/toastStore'
import { ConsolePage } from '../Console/ConsolePage'
import styles from './Espace.module.css'

interface DeleteValues {
  password: string
  confirm: boolean
}

interface ProfileDraft {
  name: string
  last_name: string
  phone: string
  address: string
  district_id: number | null
  is_vulnerable: boolean
}

function draftFrom(user: User): ProfileDraft {
  return {
    name: user.name,
    last_name: user.last_name,
    phone: user.phone ?? '',
    address: user.address ?? '',
    district_id: user.district_id,
    is_vulnerable: user.is_vulnerable,
  }
}

function leaveAfterDeletion() {
  useAuthStore.getState().signOut()
  signOutCitizen()
  rewindToCockpit()
}

function ProfilePanel({ user }: { user: User }) {
  const update = useUpdateMe()
  const districts = useDistricts()
  const [draft, setDraft] = useState(() => draftFrom(user))

  useEffect(() => {
    setDraft(draftFrom(user))
  }, [
    user.id,
    user.updated_at,
    user.name,
    user.last_name,
    user.phone,
    user.address,
    user.district_id,
    user.is_vulnerable,
  ])

  const form = useApiForm({
    labels: {
      name: 'Prénom',
      last_name: 'Nom',
      phone: 'Téléphone',
      address: 'Adresse',
      district_id: 'Quartier',
      is_vulnerable: 'Personne vulnérable',
    },
    validate: (values: ProfileDraft) => {
      const errors: Record<string, string> = {}
      if (!values.name.trim()) errors.name = 'Saisissez votre prénom.'
      if (!values.last_name.trim()) errors.last_name = 'Saisissez votre nom.'
      return errors
    },
    submit: (values: ProfileDraft) =>
      update.mutateAsync({
        name: values.name.trim(),
        last_name: values.last_name.trim(),
        phone: values.phone.trim() || null,
        address: values.address.trim() || null,
        district_id: values.district_id,
        is_vulnerable: values.is_vulnerable,
      }),
    onSuccess: () => announce('Profil enregistré'),
  })

  const set =
    <K extends keyof ProfileDraft>(key: K) =>
    (value: ProfileDraft[K]) => {
      setDraft((current) => ({ ...current, [key]: value }))
      form.clearError(key)
    }

  return (
    <GlassPanel className={styles.card}>
      <h2>Mes informations</h2>
      <p className={text.note}>L’adresse e-mail sert à vous connecter ; elle ne se modifie pas ici.</p>
      <form
        className={styles.profileForm}
        noValidate
        onSubmit={(event: FormEvent) => {
          event.preventDefault()
          void form.handleSubmit(draft)
        }}
      >
        <ErrorSummary id={form.summaryId} errors={form.summary} formError={form.formError} />
        <Field label="E-mail">
          <input type="email" value={user.email} disabled readOnly autoComplete="username" />
        </Field>
        <div className={styles.profileRow}>
          <Field label="Prénom" htmlFor={form.fieldId('name')} required error={form.errors.name}>
            {(control) => (
              <input
                {...control}
                autoComplete="given-name"
                value={draft.name}
                onChange={(e) => set('name')(e.target.value)}
              />
            )}
          </Field>
          <Field label="Nom" htmlFor={form.fieldId('last_name')} required error={form.errors.last_name}>
            {(control) => (
              <input
                {...control}
                autoComplete="family-name"
                value={draft.last_name}
                onChange={(e) => set('last_name')(e.target.value)}
              />
            )}
          </Field>
        </div>
        <Field label="Téléphone" htmlFor={form.fieldId('phone')} error={form.errors.phone}>
          {(control) => (
            <input
              {...control}
              type="tel"
              autoComplete="tel"
              value={draft.phone}
              onChange={(e) => set('phone')(e.target.value)}
            />
          )}
        </Field>
        <Field label="Adresse" htmlFor={form.fieldId('address')} error={form.errors.address}>
          {(control) => (
            <input
              {...control}
              autoComplete="street-address"
              value={draft.address}
              onChange={(e) => set('address')(e.target.value)}
            />
          )}
        </Field>
        <Field label="Quartier" htmlFor={form.fieldId('district_id')} error={form.errors.district_id}>
          {(control) => (
            <select
              {...control}
              value={draft.district_id ?? ''}
              disabled={districts.isPending || districts.isError}
              onChange={(e) => set('district_id')(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">
                {districts.isError
                  ? 'Quartiers indisponibles'
                  : districts.isPending
                    ? 'Chargement…'
                    : 'Aucun quartier précisé'}
              </option>
              {(districts.data ?? []).map((district) => (
                <option key={district.id} value={district.id}>
                  {district.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <div className={styles.checkboxRow}>
          <input
            id={form.fieldId('is_vulnerable')}
            type="checkbox"
            checked={draft.is_vulnerable}
            onChange={(e) => set('is_vulnerable')(e.target.checked)}
          />
          <label htmlFor={form.fieldId('is_vulnerable')}>
            Je souhaite être prévenu·e en priorité en cas d’alerte sanitaire (personne vulnérable)
          </label>
        </div>
        <div className={styles.cardActions}>
          <Button type="submit" disabled={form.pending}>
            {form.pending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </form>
    </GlassPanel>
  )
}

function DeletePanel() {
  const navigate = useNavigate()
  const remove = useDeleteMyAccount()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState(false)

  const form = useApiForm<DeleteValues, { deleted: true; message: string }>({
    labels: { password: 'Mot de passe', confirm: 'Confirmation' },
    validate: (values) => {
      const errors: Record<string, string> = {}
      if (!values.password.trim()) errors.password = 'Saisissez votre mot de passe.'
      if (!values.confirm) errors.confirm = 'Cochez la case pour confirmer.'
      return errors
    },
    describeError: (error) => (/incorrect/i.test(toApiError(error).message) ? 'Mot de passe incorrect.' : null),
    submit: (values) => remove.mutateAsync({ password: values.password, confirm: true }),
    onSuccess: () => {
      leaveAfterDeletion()
      navigate({ pathname: '/', search: '?compte=supprime' }, { replace: true })
    },
  })

  const close = () => {
    if (form.pending) return
    setOpen(false)
    setPassword('')
    setConfirm(false)
  }

  const canSubmit = password.trim().length > 0 && confirm && !form.pending

  return (
    <>
      <GlassPanel className={[styles.card, styles.dangerZone].join(' ')}>
        <h2>Supprimer mon compte</h2>
        <p className={text.note}>Avant de continuer, voici ce qui se passe :</p>
        <ul className={styles.consequences}>
          <li>Votre compte et vos moyens de connexion sont effacés définitivement.</li>
          <li>Vos demandes passées restent archivées par la ville, sans être rattachées à votre identité.</li>
          <li>Vos rendez-vous à venir sont annulés.</li>
          <li>Vos notifications sont supprimées.</li>
        </ul>
        <Button className={styles.dangerButton} onClick={() => setOpen(true)}>
          Supprimer mon compte
        </Button>
      </GlassPanel>

      <ConfirmDialog
        open={open}
        title="Confirmer la suppression"
        onClose={close}
        footer={
          <>
            <Button variant="ghost" onClick={close} disabled={form.pending}>
              Annuler
            </Button>
            <Button className={styles.dangerButton} type="submit" form="delete-account-form" disabled={!canSubmit}>
              {form.pending ? 'Suppression…' : 'Supprimer définitivement'}
            </Button>
          </>
        }
      >
        <form
          id="delete-account-form"
          className={styles.dialogStack}
          noValidate
          onSubmit={(event: FormEvent) => {
            event.preventDefault()
            void form.handleSubmit({ password, confirm })
          }}
        >
          <ErrorSummary id={form.summaryId} errors={form.summary} formError={form.formError} />
          <p className={text.note}>
            Pour éviter qu’une session ouverte ne ferme votre compte, saisissez votre mot de passe.
          </p>
          <Field label="Mot de passe" htmlFor={form.fieldId('password')} required error={form.errors.password}>
            {(control) => (
              <input
                {...control}
                data-autofocus
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
          <div className={styles.checkboxRow}>
            <input
              id={form.fieldId('confirm')}
              type="checkbox"
              checked={confirm}
              aria-invalid={form.errors.confirm ? true : undefined}
              aria-describedby={form.errors.confirm ? `${form.fieldId('confirm')}-error` : undefined}
              onChange={(e) => {
                setConfirm(e.target.checked)
                form.clearError('confirm')
              }}
            />
            <label htmlFor={form.fieldId('confirm')}>
              Je comprends que cette action est définitive
              {form.errors.confirm ? (
                <span id={`${form.fieldId('confirm')}-error`} className={text.error} role="alert">
                  {' '}
                  — {form.errors.confirm}
                </span>
              ) : null}
            </label>
          </div>
        </form>
      </ConfirmDialog>
    </>
  )
}

/** D03 / F33: edit personal info, or delete the account with password confirmation. */
export default function ComptePage() {
  const citizen = useCitizenUser()
  const me = useMe(Boolean(citizen))
  const user = me.data ?? citizen

  return (
    <ConsolePage
      title="Compte"
      crumbs={[{ label: 'Mon espace', to: '/ville/espace' }]}
      lead="Mettez à jour vos informations, ou fermez votre compte si vous quittez Terra Nova."
    >
      <div className={styles.compteStack}>
        {me.isError && !citizen ? (
          <p className={text.error}>
            {messageFor(me.error)}{' '}
            <button type="button" onClick={() => void me.refetch()}>
              Réessayer
            </button>
          </p>
        ) : null}
        {user ? <ProfilePanel user={user} /> : <p className={text.note}>Chargement du profil…</p>}
        <DeletePanel />
      </div>
    </ConsolePage>
  )
}
