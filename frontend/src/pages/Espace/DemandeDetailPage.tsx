import { useState, type FormEvent } from 'react'
import { useParams } from 'react-router'
import { imgUrl } from '../../api/client'
import { messageFor, toApiError } from '../../api/errors'
import { useAddComment, useRequest } from '../../api/requests'
import { friseTone, isOpenStatus, requestStatusMessages } from '../../api/requestStatus'
import type { RequestDetail, RequestEvent } from '../../api/types'
import { useApiForm } from '../../hooks/useApiForm'
import { defineMessages, useMessages } from '../../i18n'
import { formatDateTime, formatRelative } from '../../lib/format'
import { useNow } from '../../lib/useNow'
import { Button, ButtonRouteLink } from '../../ui/Button'
import { ErrorSummary } from '../../ui/ErrorSummary'
import { Field } from '../../ui/Field'
import { GlassPanel } from '../../ui/GlassPanel'
import text from '../../ui/text.module.css'
import { ConsolePage } from '../Console/ConsolePage'
import { espaceMessages } from './espace.messages'
import { RequestFrise } from './RequestFrise'
import styles from './Espace.module.css'

const messages = defineMessages(
  {
    municipalService: 'Service municipal',
    details: 'Détails',
    place: 'Lieu',
    position: 'Position',
    attachment: 'Pièce jointe',
    seeFile: 'Voir le fichier',
    messageLabel: 'Votre message',
    messageRequired: 'Écrivez un message.',
    replyNeeded: 'Votre réponse est attendue',
    addMessage: 'Ajouter un message',
    sending: 'Envoi…',
    send: 'Envoyer',
    notFound: 'Demande introuvable',
    notFoundLead: 'Cette demande n’existe pas ou ne vous est pas accessible.',
    backToRequests: 'Retour à mes demandes',
    request: 'Demande',
    lead: (type: string) => `${type} · suivi de votre demande`,
    copyReference: 'Copier la référence',
    history: 'Historique',
    noEvents: 'Aucune étape publique pour le moment.',
  },
  {
    municipalService: 'Municipal service',
    details: 'Details',
    place: 'Place',
    position: 'Position',
    attachment: 'Attachment',
    seeFile: 'View the file',
    messageLabel: 'Your message',
    messageRequired: 'Write a message.',
    replyNeeded: 'Your reply is needed',
    addMessage: 'Add a message',
    sending: 'Sending…',
    send: 'Send',
    notFound: 'Request not found',
    notFoundLead: 'This request does not exist or is not available to you.',
    backToRequests: 'Back to my requests',
    request: 'Request',
    lead: (type) => `${type} · tracking your request`,
    copyReference: 'Copy the reference',
    history: 'History',
    noEvents: 'No public steps yet.',
  },
)

type Labels = (typeof requestStatusMessages)['fr']
type Words = (typeof messages)['fr']

function eventTitle(event: RequestEvent, labels: Labels): string {
  if (event.type === 'STATUS_CHANGED' && event.to_status) return labels.status[event.to_status]
  return labels.event[event.type]
}

function eventWho(event: RequestEvent, m: Words): string {
  if (!event.author) return m.municipalService
  return `${event.author.name} ${event.author.last_name}`.trim()
}

function Recap({ request }: { request: RequestDetail }) {
  const m = useMessages(messages)
  const hasLocation = Boolean(request.location_label || (request.latitude != null && request.longitude != null))
  const dataEntries = request.data ? Object.entries(request.data).filter(([key]) => key !== 'urgency_hint') : []
  if (!hasLocation && !request.attachment && dataEntries.length === 0) return null

  return (
    <GlassPanel className={styles.card}>
      <h2>{m.details}</h2>
      <dl className={styles.recapList}>
        {request.location_label && (
          <>
            <dt>{m.place}</dt>
            <dd>{request.location_label}</dd>
          </>
        )}
        {request.latitude != null && request.longitude != null && (
          <>
            <dt>{m.position}</dt>
            <dd>
              {request.latitude.toFixed(5)}, {request.longitude.toFixed(5)}
            </dd>
          </>
        )}
        {request.attachment && (
          <>
            <dt>{m.attachment}</dt>
            <dd>
              <a href={`${imgUrl}${request.attachment}`} target="_blank" rel="noreferrer">
                {m.seeFile}
              </a>
            </dd>
          </>
        )}
        {dataEntries.map(([key, value]) => (
          <div key={key}>
            <dt>{key}</dt>
            <dd>{typeof value === 'string' || typeof value === 'number' ? String(value) : JSON.stringify(value)}</dd>
          </div>
        ))}
      </dl>
    </GlassPanel>
  )
}

function ReplyForm({ request }: { request: RequestDetail }) {
  const addComment = useAddComment()
  const [message, setMessage] = useState('')
  const waiting = request.status === 'WAITING_CITIZEN'
  const m = useMessages(messages)
  const form = useApiForm({
    labels: { message: m.messageLabel },
    submit: (values: { message: string }) =>
      addComment.mutateAsync({ id: request.id, message: values.message, is_internal: false }),
    validate: (values) => {
      const errors: Record<string, string> = {}
      if (!values.message.trim()) errors.message = m.messageRequired
      return errors
    },
    onSuccess: () => setMessage(''),
  })

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    void form.handleSubmit({ message })
  }

  return (
    <GlassPanel className={styles.card}>
      <form className={styles.reply} data-emphasis={waiting || undefined} onSubmit={onSubmit} noValidate>
        <h2>{waiting ? m.replyNeeded : m.addMessage}</h2>
        <ErrorSummary id={form.summaryId} errors={form.summary} formError={form.formError} />
        <Field label={m.messageLabel} htmlFor={form.fieldId('message')} required error={form.errors.message}>
          {(control) => (
            <textarea
              {...control}
              rows={4}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              disabled={form.pending}
            />
          )}
        </Field>
        <div className={styles.cardActions}>
          <Button type="submit" disabled={form.pending}>
            {form.pending ? m.sending : m.send}
          </Button>
        </div>
      </form>
    </GlassPanel>
  )
}

/** D11: citizen request detail with frise, public history and reply. */
export default function DemandeDetailPage() {
  const { id: raw } = useParams()
  const id = Number(raw)
  const validId = Number.isInteger(id) && id > 0
  const detail = useRequest(validId ? id : undefined)
  const now = useNow()
  const m = useMessages(messages)
  const common = useMessages(espaceMessages)
  const labels = useMessages(requestStatusMessages)
  const crumbs = [
    { label: common.espace, to: '/ville/espace' },
    { label: common.requests, to: '/ville/espace/demandes' },
  ]

  if (!validId || (detail.isError && toApiError(detail.error).status === 404)) {
    return (
      <ConsolePage
        title={m.notFound}
        crumbs={crumbs}
        lead={m.notFoundLead}
      >
        <GlassPanel className={styles.card}>
          <ButtonRouteLink to="/ville/espace/demandes">{m.backToRequests}</ButtonRouteLink>
        </GlassPanel>
      </ConsolePage>
    )
  }

  if (detail.isPending) {
    return (
      <ConsolePage
        title={m.request}
        crumbs={crumbs}
      >
        <p className={text.note}>{common.loading}</p>
      </ConsolePage>
    )
  }

  if (detail.isError || !detail.data) {
    return (
      <ConsolePage
        title={m.request}
        crumbs={crumbs}
      >
        <p className={text.error}>
          {messageFor(detail.error)}{' '}
          <button type="button" onClick={() => void detail.refetch()}>
            {common.retry}
          </button>
        </p>
      </ConsolePage>
    )
  }

  const request = detail.data
  const events = [...request.events].reverse()

  return (
    <ConsolePage
      title={request.subject}
      crumbs={crumbs}
      lead={m.lead(labels.type[request.type])}
    >
      <GlassPanel className={styles.card}>
        <div className={styles.headerBlock}>
          <div className={styles.refRow}>
            <span className={styles.pill} data-tone={friseTone(request.status)}>
              {labels.status[request.status]}
            </span>
            <code>{request.reference}</code>
            <Button
              type="button"
              small
              variant="ghost"
              onClick={() => void navigator.clipboard.writeText(request.reference)}
            >
              {m.copyReference}
            </Button>
          </div>
          <RequestFrise status={request.status} />
        </div>
      </GlassPanel>

      <GlassPanel className={styles.card}>
        <h2>{m.history}</h2>
        {events.length === 0 ? (
          <p className={text.note}>{m.noEvents}</p>
        ) : (
          <ol className={styles.events}>
            {events.map((event) => (
              <li key={event.id} className={styles.event}>
                <p className={styles.eventTitle}>{eventTitle(event, labels)}</p>
                <p className={styles.eventMeta}>
                  {eventWho(event, m)} · {formatRelative(event.created_at, now)} · {formatDateTime(event.created_at)}
                </p>
                {event.message && <p className={styles.eventBody}>{event.message}</p>}
              </li>
            ))}
          </ol>
        )}
      </GlassPanel>

      {isOpenStatus(request.status) && <ReplyForm request={request} />}
      <Recap request={request} />
    </ConsolePage>
  )
}
