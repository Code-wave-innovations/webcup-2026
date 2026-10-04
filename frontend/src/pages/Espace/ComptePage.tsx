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
import { defineMessages, useMessages } from '../../i18n'
import { Button } from '../../ui/Button'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import { ErrorSummary } from '../../ui/ErrorSummary'
import { Field } from '../../ui/Field'
import { GlassPanel } from '../../ui/GlassPanel'
import { LanguageSwitch } from '../../ui/LanguageSwitch'
import text from '../../ui/text.module.css'
import { announce } from '../../ui/toastStore'
import { ConsolePage } from '../Console/ConsolePage'
import { espaceMessages } from './espace.messages'
import styles from './Espace.module.css'

const messages = defineMessages(
  {
    title: 'Compte',
    lead: 'Mettez à jour vos informations, ou fermez votre compte si vous quittez Terra Nova.',
    loadingProfile: 'Chargement du profil…',
    profile: {
      title: 'Mes informations',
      emailNote: 'L’adresse e-mail sert à vous connecter ; elle ne se modifie pas ici.',
      email: 'E-mail',
      name: 'Prénom',
      lastName: 'Nom',
      phone: 'Téléphone',
      address: 'Adresse',
      district: 'Quartier',
      vulnerable: 'Personne vulnérable',
      nameRequired: 'Saisissez votre prénom.',
      lastNameRequired: 'Saisissez votre nom.',
      saved: 'Profil enregistré',
      districtsUnavailable: 'Quartiers indisponibles',
      loading: 'Chargement…',
      noDistrict: 'Aucun quartier précisé',
      vulnerableLabel: 'Je souhaite être prévenu·e en priorité en cas d’alerte sanitaire (personne vulnérable)',
      saving: 'Enregistrement…',
      save: 'Enregistrer',
    },
    language: {
      title: 'Langue',
      note: 'La langue de l’interface. Elle est aussi enregistrée sur votre profil pour vos notifications.',
    },
    remove: {
      title: 'Supprimer mon compte',
      intro: 'Avant de continuer, voici ce qui se passe :',
      consequences: [
        'Votre compte et vos moyens de connexion sont effacés définitivement.',
        'Vos demandes passées restent archivées par la ville, sans être rattachées à votre identité.',
        'Vos rendez-vous à venir sont annulés.',
        'Vos notifications sont supprimées.',
      ],
      confirmTitle: 'Confirmer la suppression',
      cancel: 'Annuler',
      deleting: 'Suppression…',
      deleteForGood: 'Supprimer définitivement',
      passwordNote: 'Pour éviter qu’une session ouverte ne ferme votre compte, saisissez votre mot de passe.',
      password: 'Mot de passe',
      confirmation: 'Confirmation',
      passwordRequired: 'Saisissez votre mot de passe.',
      confirmRequired: 'Cochez la case pour confirmer.',
      wrongPassword: 'Mot de passe incorrect.',
      understand: 'Je comprends que cette action est définitive',
    },
  },
  {
    title: 'Account',
    lead: 'Update your details, or close your account if you are leaving Terra Nova.',
    loadingProfile: 'Loading your profile…',
    profile: {
      title: 'My details',
      emailNote: 'Your e-mail address is how you sign in; it cannot be changed here.',
      email: 'E-mail',
      name: 'First name',
      lastName: 'Last name',
      phone: 'Phone',
      address: 'Address',
      district: 'District',
      vulnerable: 'Vulnerable person',
      nameRequired: 'Enter your first name.',
      lastNameRequired: 'Enter your last name.',
      saved: 'Profile saved',
      districtsUnavailable: 'Districts unavailable',
      loading: 'Loading…',
      noDistrict: 'No district given',
      vulnerableLabel: 'I would like to be warned first in the event of a health alert (vulnerable person)',
      saving: 'Saving…',
      save: 'Save',
    },
    language: {
      title: 'Language',
      note: 'The language of the interface. It is also saved on your profile for your notifications.',
    },
    remove: {
      title: 'Delete my account',
      intro: 'Before you go on, here is what happens:',
      consequences: [
        'Your account and your sign-in methods are erased for good.',
        'Your past requests stay archived by the city, no longer linked to your identity.',
        'Your upcoming appointments are cancelled.',
        'Your notifications are deleted.',
      ],
      confirmTitle: 'Confirm the deletion',
      cancel: 'Cancel',
      deleting: 'Deleting…',
      deleteForGood: 'Delete for good',
      passwordNote: 'So that an open session cannot close your account, enter your password.',
      password: 'Password',
      confirmation: 'Confirmation',
      passwordRequired: 'Enter your password.',
      confirmRequired: 'Tick the box to confirm.',
      wrongPassword: 'Incorrect password.',
      understand: 'I understand that this cannot be undone',
    },
  },
)

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
  const m = useMessages(messages).profile

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
      name: m.name,
      last_name: m.lastName,
      phone: m.phone,
      address: m.address,
      district_id: m.district,
      is_vulnerable: m.vulnerable,
    },
    validate: (values: ProfileDraft) => {
      const errors: Record<string, string> = {}
      if (!values.name.trim()) errors.name = m.nameRequired
      if (!values.last_name.trim()) errors.last_name = m.lastNameRequired
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
    onSuccess: () => announce(m.saved),
  })

  const set =
    <K extends keyof ProfileDraft>(key: K) =>
    (value: ProfileDraft[K]) => {
      setDraft((current) => ({ ...current, [key]: value }))
      form.clearError(key)
    }

  return (
    <GlassPanel className={styles.card}>
      <h2>{m.title}</h2>
      <p className={text.note}>{m.emailNote}</p>
      <form
        className={styles.profileForm}
        noValidate
        onSubmit={(event: FormEvent) => {
          event.preventDefault()
          void form.handleSubmit(draft)
        }}
      >
        <ErrorSummary id={form.summaryId} errors={form.summary} formError={form.formError} />
        <Field label={m.email}>
          <input type="email" value={user.email} disabled readOnly autoComplete="username" />
        </Field>
        <div className={styles.profileRow}>
          <Field label={m.name} htmlFor={form.fieldId('name')} required error={form.errors.name}>
            {(control) => (
              <input
                {...control}
                autoComplete="given-name"
                value={draft.name}
                onChange={(e) => set('name')(e.target.value)}
              />
            )}
          </Field>
          <Field label={m.lastName} htmlFor={form.fieldId('last_name')} required error={form.errors.last_name}>
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
        <Field label={m.phone} htmlFor={form.fieldId('phone')} error={form.errors.phone}>
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
        <Field label={m.address} htmlFor={form.fieldId('address')} error={form.errors.address}>
          {(control) => (
            <input
              {...control}
              autoComplete="street-address"
              value={draft.address}
              onChange={(e) => set('address')(e.target.value)}
            />
          )}
        </Field>
        <Field label={m.district} htmlFor={form.fieldId('district_id')} error={form.errors.district_id}>
          {(control) => (
            <select
              {...control}
              value={draft.district_id ?? ''}
              disabled={districts.isPending || districts.isError}
              onChange={(e) => set('district_id')(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">
                {districts.isError ? m.districtsUnavailable : districts.isPending ? m.loading : m.noDistrict}
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
            {m.vulnerableLabel}
          </label>
        </div>
        <div className={styles.cardActions}>
          <Button type="submit" disabled={form.pending}>
            {form.pending ? m.saving : m.save}
          </Button>
        </div>
      </form>
    </GlassPanel>
  )
}

/** D14: the interface language; `LocaleSync` saves the choice on the profile (`locale`). */
function LanguagePanel() {
  const m = useMessages(messages).language
  return (
    <GlassPanel className={styles.card}>
      <h2>{m.title}</h2>
      <p className={text.note}>{m.note}</p>
      <div className={styles.cardActions}>
        <LanguageSwitch />
      </div>
    </GlassPanel>
  )
}

function DeletePanel() {
  const navigate = useNavigate()
  const remove = useDeleteMyAccount()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState(false)
  const m = useMessages(messages).remove

  const form = useApiForm<DeleteValues, { deleted: true; message: string }>({
    labels: { password: m.password, confirm: m.confirmation },
    validate: (values) => {
      const errors: Record<string, string> = {}
      if (!values.password.trim()) errors.password = m.passwordRequired
      if (!values.confirm) errors.confirm = m.confirmRequired
      return errors
    },
    describeError: (error) => (/incorrect/i.test(toApiError(error).message) ? m.wrongPassword : null),
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
        <h2>{m.title}</h2>
        <p className={text.note}>{m.intro}</p>
        <ul className={styles.consequences}>
          {m.consequences.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <Button className={styles.dangerButton} onClick={() => setOpen(true)}>
          {m.title}
        </Button>
      </GlassPanel>

      <ConfirmDialog
        open={open}
        title={m.confirmTitle}
        onClose={close}
        footer={
          <>
            <Button variant="ghost" onClick={close} disabled={form.pending}>
              {m.cancel}
            </Button>
            <Button className={styles.dangerButton} type="submit" form="delete-account-form" disabled={!canSubmit}>
              {form.pending ? m.deleting : m.deleteForGood}
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
          <p className={text.note}>{m.passwordNote}</p>
          <Field label={m.password} htmlFor={form.fieldId('password')} required error={form.errors.password}>
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
              {m.understand}
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
  const m = useMessages(messages)
  const common = useMessages(espaceMessages)

  return (
    <ConsolePage
      title={m.title}
      crumbs={[{ label: common.espace, to: '/ville/espace' }]}
      lead={m.lead}
    >
      <div className={styles.compteStack}>
        {me.isError && !citizen ? (
          <p className={text.error}>
            {messageFor(me.error)}{' '}
            <button type="button" onClick={() => void me.refetch()}>
              {common.retry}
            </button>
          </p>
        ) : null}
        {user ? <ProfilePanel user={user} /> : <p className={text.note}>{m.loadingProfile}</p>}
        <LanguagePanel />
        <DeletePanel />
      </div>
    </ConsolePage>
  )
}
