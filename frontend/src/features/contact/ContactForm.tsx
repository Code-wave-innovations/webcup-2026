import { useState, type FormEvent } from 'react'
import { isApiError } from '../../api/errors'
import { createContact, type CreatedContact } from '../../api/requests'
import { usePublicServices } from '../../api/services'
import { useCitizenUser } from '../../api/session'
import { useApiForm } from '../../hooks/useApiForm'
import { Button } from '../../ui/Button'
import { ErrorSummary } from '../../ui/ErrorSummary'
import { Field } from '../../ui/Field'
import { GlassPanel } from '../../ui/GlassPanel'
import text from '../../ui/text.module.css'
import { useAuthStore } from '../auth/authStore'
import { HoneypotFields } from '../security/HoneypotFields'
import { formGuardPayload } from '../security/formGuard'
import { Turnstile } from '../security/Turnstile'
import styles from './Contact.module.css'

const LABELS = {
  subject: 'Objet',
  message: 'Message',
  contact_name: 'Votre nom',
  contact_email: 'Votre e-mail',
  service_id: 'Service concerné',
}

interface ContactFormProps {
  onSent: (result: CreatedContact) => void
  /** Inside a CitySection glass card: no nested panel, tighter fields. */
  embedded?: boolean
}

/** Prefill from `nova-auth-citizen`; demo airlock chrome (`authStore`) only when that slot is empty. */
function useContactIdentity(): { name: string; email: string; asCitizen: boolean } | null {
  const citizen = useCitizenUser()
  const citySession = useAuthStore((s) => s.session)

  if (citizen) {
    return {
      name: `${citizen.name} ${citizen.last_name}`.trim(),
      email: citizen.email,
      asCitizen: true,
    }
  }

  // Film-only demo login (no API JWT): still prefill the public contact form.
  if (citySession?.email) {
    return { name: citySession.name, email: citySession.email, asCitizen: false }
  }

  return null
}

/** D04: message to municipal services — name/email only when nobody is signed in. */
export function ContactForm({ onSent, embedded = false }: ContactFormProps) {
  const identity = useContactIdentity()
  const services = usePublicServices()
  const [startedAt] = useState(() => Date.now())
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [turnstileNeeded, setTurnstileNeeded] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)

  const form = useApiForm<Record<string, never>, CreatedContact>({
    labels: LABELS,
    submit: async () => {
      const visitor = identity
        ? identity.asCitizen
          ? {}
          : { contact_name: identity.name, contact_email: identity.email }
        : { contact_name: contactName.trim(), contact_email: contactEmail.trim() }
      return createContact({
        subject: subject.trim(),
        message: message.trim(),
        ...visitor,
        ...(serviceId ? { service_id: Number(serviceId) } : {}),
        ...formGuardPayload(startedAt, turnstileToken),
      })
    },
    validate: () => {
      const errors: Record<string, string> = {}
      if (!subject.trim()) errors.subject = 'Indiquez l’objet de votre message.'
      if (message.trim().length < 10) errors.message = 'Décrivez votre demande en au moins 10 caractères.'
      if (!identity) {
        if (!contactName.trim()) errors.contact_name = 'Indiquez votre nom.'
        if (!contactEmail.trim()) errors.contact_email = 'Indiquez une adresse e-mail pour vous répondre.'
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
          errors.contact_email = 'Cette adresse e-mail n’est pas valide.'
        }
      }
      return errors
    },
    onSuccess: (result) => {
      setTurnstileNeeded(false)
      setTurnstileToken(null)
      onSent(result)
    },
    describeError: (error) => {
      if (isApiError(error) && error.code === 'TURNSTILE_REQUIRED') {
        setTurnstileNeeded(true)
        setTurnstileToken(null)
      }
      return null
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    void form.handleSubmit({})
  }

  const fields = (
    <form className={embedded ? styles.embeddedForm : undefined} noValidate onSubmit={submit}>
      <HoneypotFields />
      <ErrorSummary id={form.summaryId} errors={form.summary} formError={form.formError} />
      {identity ? (
        <p className={text.note}>
          Envoyé en tant que <strong>{identity.name}</strong> ({identity.email}).
        </p>
      ) : (
        <div className={styles.pair}>
          <Field label={LABELS.contact_name} htmlFor={form.fieldId('contact_name')} required error={form.errors.contact_name}>
            {(control) => (
              <input
                {...control}
                autoComplete="name"
                value={contactName}
                onChange={(e) => {
                  setContactName(e.target.value)
                  form.clearError('contact_name')
                }}
              />
            )}
          </Field>
          <Field label={LABELS.contact_email} htmlFor={form.fieldId('contact_email')} required error={form.errors.contact_email}>
            {(control) => (
              <input
                {...control}
                type="email"
                autoComplete="email"
                value={contactEmail}
                onChange={(e) => {
                  setContactEmail(e.target.value)
                  form.clearError('contact_email')
                }}
              />
            )}
          </Field>
        </div>
      )}
      <Field label={LABELS.subject} htmlFor={form.fieldId('subject')} required error={form.errors.subject}>
        {(control) => (
          <input
            {...control}
            maxLength={200}
            placeholder="Ex. Question sur les horaires de la navette"
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value)
              form.clearError('subject')
            }}
          />
        )}
      </Field>
      {!embedded && (
        <Field
          label={LABELS.service_id}
          htmlFor={form.fieldId('service_id')}
          hint="Facultatif — pour aiguiller votre message."
          error={form.errors.service_id}
        >
          {(control) => (
            <select
              {...control}
              value={serviceId}
              onChange={(e) => {
                setServiceId(e.target.value)
                form.clearError('service_id')
              }}
            >
              <option value="">Aucun service en particulier</option>
              {(services.data ?? []).map((service) => (
                <option key={service.id} value={service.id} disabled={service.availability.status === 'UNAVAILABLE'}>
                  {service.name}
                  {service.availability.status === 'UNAVAILABLE' ? ' (indisponible)' : ''}
                </option>
              ))}
            </select>
          )}
        </Field>
      )}
      <Field label={LABELS.message} htmlFor={form.fieldId('message')} required error={form.errors.message}>
        {(control) => (
          <textarea
            {...control}
            rows={embedded ? 4 : 6}
            maxLength={4000}
            placeholder="Décrivez votre question ou la difficulté rencontrée."
            value={message}
            onChange={(e) => {
              setMessage(e.target.value)
              form.clearError('message')
            }}
          />
        )}
      </Field>
      {turnstileNeeded && (
        <Turnstile
          onToken={(token) => {
            setTurnstileToken(token)
          }}
        />
      )}
      <div className={styles.actions}>
        <Button type="submit" disabled={form.pending || (turnstileNeeded && !turnstileToken)} {...(embedded ? { 'data-nova-look': true } : {})}>
          {form.pending ? 'Envoi…' : 'Envoyer le message'}
        </Button>
      </div>
    </form>
  )

  if (embedded) return fields

  return (
    <GlassPanel className={styles.form}>
      <h2>Votre message</h2>
      <p className={text.note}>
        {identity
          ? 'Le message part avec votre identité de connexion.'
          : 'Sans compte, laissez un nom et un e-mail pour que les services puissent vous répondre.'}
      </p>
      {fields}
    </GlassPanel>
  )
}
