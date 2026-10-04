import { useState } from 'react'
import { messageFor } from '../../api/errors'
import type { IdentityCheck, IssuedResetCode, ManagedUser } from '../../api/types'
import { useCancelResetCode, useIssueResetCode } from '../../api/users'
import { useApiForm } from '../../hooks/useApiForm'
import { formatDateTime } from '../lib/format'
import { useNow } from '../lib/useNow'
import { toast } from '../stores/toastStore'
import { Flag } from '../ui/Badges'
import { Button } from '../ui/Button'
import { ErrorSummary } from '../ui/ErrorSummary'
import { Field, TextInput, Toggle } from '../ui/Controls'
import { Modal } from '../ui/Overlay'
import layout from '../ui/layout.module.css'
import styles from './shared.module.css'

const CHECKS: { value: IdentityCheck; label: string; hint: string }[] = [
  { value: 'ID_DOCUMENT', label: 'Pièce d’identité présentée au guichet', hint: 'Le nom et la photo correspondent au titulaire du compte.' },
  { value: 'IN_PERSON_KNOWN', label: 'Personne connue du service, présente au guichet', hint: 'Vous la reconnaissez et elle confirme son adresse.' },
  { value: 'PHONE_QUESTIONS', label: 'Par téléphone, questions de contrôle', hint: 'Elle donne elle-même son adresse et son quartier : ne les lisez jamais à voix haute.' },
]

const name = (user: Pick<ManagedUser, 'name' | 'last_name'>) => `${user.name} ${user.last_name}`

/**
 * F34: a person who lost access to their account (forgotten password, lost phone) gets back in with
 * the city's help, without anyone else being able to. The agent checks their identity, then hands
 * over a one-time code (30 min) that the person types in the airlock with a new password of their
 * choosing: the agent never sees, sets or knows the password. The person is notified, the audit
 * keeps how the identity was checked.
 */
export function AccessRecovery({ user, self }: { user: ManagedUser; self: boolean }) {
  const now = useNow()
  const cancel = useCancelResetCode()
  const [open, setOpen] = useState(false)
  const pending = user.reset_code_expires_at && Date.parse(user.reset_code_expires_at) > now ? user.reset_code_expires_at : null

  return (
    <div className={styles.recovery}>
      <p className={layout.sectionLabel}>Retrouver l’accès (F34)</p>
      <p className={[layout.muted, layout.small].join(' ')}>
        Mot de passe oublié, téléphone perdu ? Vérifiez l’identité de la personne, puis remettez-lui un code à usage unique : elle choisit elle-même son nouveau mot de passe dans le sas.
        Vous ne voyez jamais son mot de passe.
      </p>
      {pending && (
        <div className={layout.row}>
          <Flag icon="lock" tone="progress">
            Code remis · valable jusqu’à {formatDateTime(pending)}
          </Flag>
          <Button
            size="sm"
            variant="subtle"
            disabled={cancel.isPending}
            onClick={() =>
              cancel.mutate(user.id, {
                onSuccess: () => toast('Code annulé : il ne fonctionne plus', 'info'),
                onError: (error) => toast(messageFor(error), 'alert'),
              })
            }
          >
            Annuler le code
          </Button>
        </div>
      )}
      <div className={layout.row}>
        <Button icon="key" disabled={!user.is_active || self} onClick={() => setOpen(true)}>
          {pending ? 'Remettre un nouveau code' : 'Aider à retrouver l’accès'}
        </Button>
      </div>
      {!user.is_active && <p className={[layout.muted, layout.small].join(' ')}>Réactivez d’abord le compte : un compte suspendu ne peut pas recevoir de code.</p>}
      {open && <RecoveryModal user={user} onClose={() => setOpen(false)} />}
    </div>
  )
}

function RecoveryModal({ user, onClose }: { user: ManagedUser; onClose: () => void }) {
  const issue = useIssueResetCode()
  const [check, setCheck] = useState<IdentityCheck | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [note, setNote] = useState('')
  const [issued, setIssued] = useState<IssuedResetCode | null>(null)

  const form = useApiForm({
    labels: { verification: 'Vérification d’identité', identity_confirmed: 'Confirmation', note: 'Note' },
    validate: (): Record<string, string> => {
      const errors: Record<string, string> = {}
      if (!check) errors.verification = 'Dites comment vous avez vérifié l’identité de la personne.'
      if (!confirmed) errors.identity_confirmed = 'Confirmez que vous parlez au titulaire du compte.'
      return errors
    },
    submit: () => issue.mutateAsync({ id: user.id, verification: check!, identity_confirmed: true, note: note.trim() || undefined }),
    onSuccess: (result) => setIssued(result),
  })

  if (issued) {
    return (
      <Modal
        open
        onClose={onClose}
        kicker="Code à usage unique"
        title={`Code pour ${name(user)}`}
        footer={
          <Button variant="primary" icon="check" onClick={onClose}>
            C’est transmis
          </Button>
        }
      >
        <div className={styles.codeReveal}>
          <p className={styles.code} aria-label={`Code : ${issued.code.split('').join(' ')}`}>
            {issued.code}
          </p>
          <p className={[layout.muted, layout.small].join(' ')}>
            Valable {issued.minutes} minutes, jusqu’à {formatDateTime(issued.expires_at)}, pour une seule utilisation. Il ne sera plus affiché.
          </p>
        </div>
        <p className={layout.sectionLabel}>À dire à la personne</p>
        <ol className={styles.steps}>
          <li>Ouvrez Nova et saisissez votre adresse e-mail : {user.email}.</li>
          <li>Choisissez « J’ai un code de la mairie ».</li>
          <li>Tapez ce code, puis choisissez vous-même votre nouveau mot de passe.</li>
        </ol>
        <p className={[layout.muted, layout.small].join(' ')}>
          Remettez le code de vive voix ou sur papier, jamais par un tiers. La personne reçoit une notification ; ses autres appareils seront déconnectés.
        </p>
      </Modal>
    )
  }

  return (
    <Modal
      open
      onClose={onClose}
      kicker="F34 · Vérification d’identité"
      title={`Aider ${name(user)} à retrouver l’accès`}
      footer={
        <>
          <Button variant="subtle" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="recovery-form" variant="primary" icon="key" disabled={form.pending} aria-busy={form.pending}>
            Générer le code
          </Button>
        </>
      }
    >
      <form
        id="recovery-form"
        className={layout.stack}
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void form.handleSubmit(undefined)
        }}
      >
        <ErrorSummary id={form.summaryId} errors={form.summary} formError={form.formError} />
        <fieldset className={styles.choices} id={form.fieldId('verification')} tabIndex={-1} aria-describedby={form.errors.verification ? `${form.fieldId('verification')}-error` : undefined}>
          <legend className={layout.sectionLabel}>1. Comment avez-vous vérifié son identité ?</legend>
          {CHECKS.map((c) => (
            <label key={c.value} className={styles.choice} data-checked={check === c.value}>
              <input type="radio" name="verification" value={c.value} checked={check === c.value} onChange={() => setCheck(c.value)} />
              <span>
                <strong>{c.label}</strong>
                <small>{c.hint}</small>
              </span>
            </label>
          ))}
          {form.errors.verification && (
            <p id={`${form.fieldId('verification')}-error`} className={styles.choiceError}>
              {form.errors.verification}
            </p>
          )}
        </fieldset>

        {check === 'PHONE_QUESTIONS' && (
          <div className={styles.preview}>
            <p className={styles.previewTitle}>Réponses attendues (à comparer, pas à lire)</p>
            <dl className={layout.dl}>
              <dt>Adresse</dt>
              <dd>{user.address ?? '—'}</dd>
              <dt>Quartier</dt>
              <dd>{user.district?.name ?? '—'}</dd>
              <dt>Téléphone</dt>
              <dd>{user.phone ?? '—'}</dd>
            </dl>
          </div>
        )}

        <p className={layout.sectionLabel}>2. Confirmation</p>
        <div id={form.fieldId('identity_confirmed')} tabIndex={-1}>
          <Toggle checked={confirmed} onChange={setConfirmed} label={`Je parle bien à ${name(user)}, titulaire de ce compte`} />
          {form.errors.identity_confirmed && <p className={styles.choiceError}>{form.errors.identity_confirmed}</p>}
        </div>
        <Field id={form.fieldId('note')} label="Note pour le journal (facultatif)" hint="Ex. : carte d’identité n° se terminant par 42.">
          {(id, describedBy) => <TextInput id={id} aria-describedby={describedBy} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />}
        </Field>
        <p className={[layout.muted, layout.small].join(' ')}>
          Le code remplace tout code précédent. La vérification et votre nom sont inscrits au journal d’audit.
        </p>
      </form>
    </Modal>
  )
}
