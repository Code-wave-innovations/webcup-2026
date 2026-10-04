import { useState, type FormEvent } from 'react'
import { isApiError } from '../../api/errors'
import { createContact, type CreatedContact } from '../../api/requests'
import { usePublicServices } from '../../api/services'
import { useCitizenUser } from '../../api/session'
import { useApiForm } from '../../hooks/useApiForm'
import { defineMessages, useMessages } from '../../i18n'
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

const messages = defineMessages(
  {
    labels: {
      subject: 'Objet',
      message: 'Message',
      contact_name: 'Votre nom',
      contact_email: 'Votre e-mail',
      service_id: 'Service concerné',
    },
    subjectRequired: 'Indiquez l’objet de votre message.',
    messageTooShort: 'Décrivez votre demande en au moins 10 caractères.',
    nameRequired: 'Indiquez votre nom.',
    emailRequired: 'Indiquez une adresse e-mail pour vous répondre.',
    emailInvalid: 'Cette adresse e-mail n’est pas valide.',
    title: 'Votre message',
    signedInNote: 'Le message part avec votre identité de connexion.',
    anonymousNote: 'Sans compte, laissez un nom et un e-mail pour que les services puissent vous répondre.',
    sentAs: 'Envoyé en tant que ',
    subjectPlaceholder: 'Ex. Question sur les horaires de la navette',
    serviceHint: 'Facultatif — pour aiguiller votre message.',
    noService: 'Aucun service en particulier',
    unavailable: ' (indisponible)',
    messagePlaceholder: 'Décrivez votre question ou la difficulté rencontrée.',
    sending: 'Envoi…',
    send: 'Envoyer le message',
  },
  {
    labels: {
      subject: 'Subject',
      message: 'Message',
      contact_name: 'Your name',
      contact_email: 'Your e-mail',
      service_id: 'Service concerned',
    },
    subjectRequired: 'Give your message a subject.',
    messageTooShort: 'Describe your request in at least 10 characters.',
    nameRequired: 'Enter your name.',
    emailRequired: 'Enter an e-mail address so we can reply.',
    emailInvalid: 'This e-mail address is not valid.',
    title: 'Your message',
    signedInNote: 'The message is sent with the identity you signed in with.',
    anonymousNote: 'Without an account, leave a name and an e-mail so the services can reply to you.',
    sentAs: 'Sent as ',
    subjectPlaceholder: 'E.g. Question about the shuttle timetable',
    serviceHint: 'Optional — helps route your message.',
    noService: 'No service in particular',
    unavailable: ' (unavailable)',
    messagePlaceholder: 'Describe your question or the problem you ran into.',
    sending: 'Sending…',
    send: 'Send the message',
  },
)

interface ContactFormProps {
  onSent: (result: CreatedContact) => void
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
export function ContactForm({ onSent }: ContactFormProps) {
  const identity = useContactIdentity()
  const m = useMessages(messages)
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
    labels: m.labels,
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
      if (!subject.trim()) errors.subject = m.subjectRequired
      if (message.trim().length < 10) errors.message = m.messageTooShort
      if (!identity) {
        if (!contactName.trim()) errors.contact_name = m.nameRequired
        if (!contactEmail.trim()) errors.contact_email = m.emailRequired
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
          errors.contact_email = m.emailInvalid
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

  return (
    <GlassPanel className={styles.form}>
      <h2>{m.title}</h2>
      <p className={text.note}>
        {identity ? m.signedInNote : m.anonymousNote}
      </p>
      <form noValidate onSubmit={submit}>
        <HoneypotFields />
        <ErrorSummary id={form.summaryId} errors={form.summary} formError={form.formError} />
        {identity ? (
          <p className={text.note}>
            {m.sentAs}
            <strong>{identity.name}</strong> ({identity.email}).
          </p>
        ) : (
          <div className={styles.pair}>
            <Field label={m.labels.contact_name} htmlFor={form.fieldId('contact_name')} required error={form.errors.contact_name}>
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
            <Field label={m.labels.contact_email} htmlFor={form.fieldId('contact_email')} required error={form.errors.contact_email}>
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
        <Field label={m.labels.subject} htmlFor={form.fieldId('subject')} required error={form.errors.subject}>
          {(control) => (
            <input
              {...control}
              maxLength={200}
              placeholder={m.subjectPlaceholder}
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value)
                form.clearError('subject')
              }}
            />
          )}
        </Field>
        <Field
          label={m.labels.service_id}
          htmlFor={form.fieldId('service_id')}
          hint={m.serviceHint}
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
              <option value="">{m.noService}</option>
              {(services.data ?? []).map((service) => (
                <option key={service.id} value={service.id} disabled={service.availability.status === 'UNAVAILABLE'}>
                  {service.name}
                  {service.availability.status === 'UNAVAILABLE' ? m.unavailable : ''}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label={m.labels.message} htmlFor={form.fieldId('message')} required error={form.errors.message}>
          {(control) => (
            <textarea
              {...control}
              rows={6}
              maxLength={4000}
              placeholder={m.messagePlaceholder}
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
          <Button type="submit" disabled={form.pending || (turnstileNeeded && !turnstileToken)}>
            {form.pending ? m.sending : m.send}
          </Button>
        </div>
      </form>
    </GlassPanel>
  )
}
