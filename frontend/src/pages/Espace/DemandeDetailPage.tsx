import { useState, type FormEvent } from 'react'
import { useParams } from 'react-router'
import { imgUrl } from '../../api/client'
import { messageFor, toApiError } from '../../api/errors'
import { useAddComment, useRequest } from '../../api/requests'
import {
  CITIZEN_STATUS_LABEL,
  EVENT_TYPE_LABEL,
  TYPE_LABEL,
  friseTone,
  isOpenStatus,
} from '../../api/requestStatus'
import type { RequestDetail, RequestEvent } from '../../api/types'
import { useApiForm } from '../../hooks/useApiForm'
import { formatDateTime, formatRelative } from '../../lib/format'
import { useNow } from '../../lib/useNow'
import { Button, ButtonRouteLink } from '../../ui/Button'
import { ErrorSummary } from '../../ui/ErrorSummary'
import { Field } from '../../ui/Field'
import { GlassPanel } from '../../ui/GlassPanel'
import text from '../../ui/text.module.css'
import { ConsolePage } from '../Console/ConsolePage'
import { RequestFrise } from './RequestFrise'
import styles from './Espace.module.css'

const LABELS = { message: 'Votre message' }

function eventTitle(event: RequestEvent): string {
  if (event.type === 'STATUS_CHANGED' && event.to_status) return CITIZEN_STATUS_LABEL[event.to_status]
  return EVENT_TYPE_LABEL[event.type]
}

function eventWho(event: RequestEvent): string {
  if (!event.author) return 'Service municipal'
  return `${event.author.name} ${event.author.last_name}`.trim()
}

function Recap({ request }: { request: RequestDetail }) {
  const hasLocation = Boolean(request.location_label || (request.latitude != null && request.longitude != null))
  const dataEntries = request.data ? Object.entries(request.data).filter(([key]) => key !== 'urgency_hint') : []
  if (!hasLocation && !request.attachment && dataEntries.length === 0) return null

  return (
    <GlassPanel className={styles.card}>
      <h2>Détails</h2>
      <dl className={styles.recapList}>
        {request.location_label && (
          <>
            <dt>Lieu</dt>
            <dd>{request.location_label}</dd>
          </>
        )}
        {request.latitude != null && request.longitude != null && (
          <>
            <dt>Position</dt>
            <dd>
              {request.latitude.toFixed(5)}, {request.longitude.toFixed(5)}
            </dd>
          </>
        )}
        {request.attachment && (
          <>
            <dt>Pièce jointe</dt>
            <dd>
              <a href={`${imgUrl}${request.attachment}`} target="_blank" rel="noreferrer">
                Voir le fichier
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
  const form = useApiForm({
    labels: LABELS,
    submit: (values: { message: string }) =>
      addComment.mutateAsync({ id: request.id, message: values.message, is_internal: false }),
    validate: (values) => {
      const errors: Record<string, string> = {}
      if (!values.message.trim()) errors.message = 'Écrivez un message.'
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
        <h2>{waiting ? 'Votre réponse est attendue' : 'Ajouter un message'}</h2>
        <ErrorSummary id={form.summaryId} errors={form.summary} formError={form.formError} />
        <Field label={LABELS.message} htmlFor={form.fieldId('message')} required error={form.errors.message}>
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
            {form.pending ? 'Envoi…' : 'Envoyer'}
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

  if (!validId || (detail.isError && toApiError(detail.error).status === 404)) {
    return (
      <ConsolePage
        title="Demande introuvable"
        crumbs={[
          { label: 'Mon espace', to: '/ville/espace' },
          { label: 'Mes demandes', to: '/ville/espace/demandes' },
        ]}
        lead="Cette demande n’existe pas ou ne vous est pas accessible."
      >
        <GlassPanel className={styles.card}>
          <ButtonRouteLink to="/ville/espace/demandes">Retour à mes demandes</ButtonRouteLink>
        </GlassPanel>
      </ConsolePage>
    )
  }

  if (detail.isPending) {
    return (
      <ConsolePage
        title="Demande"
        crumbs={[
          { label: 'Mon espace', to: '/ville/espace' },
          { label: 'Mes demandes', to: '/ville/espace/demandes' },
        ]}
      >
        <p className={text.note}>Chargement…</p>
      </ConsolePage>
    )
  }

  if (detail.isError || !detail.data) {
    return (
      <ConsolePage
        title="Demande"
        crumbs={[
          { label: 'Mon espace', to: '/ville/espace' },
          { label: 'Mes demandes', to: '/ville/espace/demandes' },
        ]}
      >
        <p className={text.error}>
          {messageFor(detail.error)}{' '}
          <button type="button" onClick={() => void detail.refetch()}>
            Réessayer
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
      crumbs={[
        { label: 'Mon espace', to: '/ville/espace' },
        { label: 'Mes demandes', to: '/ville/espace/demandes' },
      ]}
      lead={`${TYPE_LABEL[request.type]} · suivi de votre demande`}
    >
      <GlassPanel className={styles.card}>
        <div className={styles.headerBlock}>
          <div className={styles.refRow}>
            <span className={styles.pill} data-tone={friseTone(request.status)}>
              {CITIZEN_STATUS_LABEL[request.status]}
            </span>
            <code>{request.reference}</code>
            <Button
              type="button"
              small
              variant="ghost"
              onClick={() => void navigator.clipboard.writeText(request.reference)}
            >
              Copier la référence
            </Button>
          </div>
          <RequestFrise status={request.status} />
        </div>
      </GlassPanel>

      <GlassPanel className={styles.card}>
        <h2>Historique</h2>
        {events.length === 0 ? (
          <p className={text.note}>Aucune étape publique pour le moment.</p>
        ) : (
          <ol className={styles.events}>
            {events.map((event) => (
              <li key={event.id} className={styles.event}>
                <p className={styles.eventTitle}>{eventTitle(event)}</p>
                <p className={styles.eventMeta}>
                  {eventWho(event)} · {formatRelative(event.created_at, now)} · {formatDateTime(event.created_at)}
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
