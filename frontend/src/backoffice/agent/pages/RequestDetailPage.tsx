import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { motion } from 'motion/react'
import { imgUrl } from '../../../api/client'
import { useDashboardStats } from '../../../api/dashboard'
import { messageFor, toApiError } from '../../../api/errors'
import { useAddComment, useRequest, useRequests, useUpdateRequest } from '../../../api/requests'
import type { RequestDetail, RequestPriority, RequestStatus } from '../../../api/types'
import { useStaff, useUser } from '../../../api/users'
import { useApiForm } from '../../../hooks/useApiForm'
import { useActor, usePersona } from '../../layout/persona'
import { NEEDS_ACTION, PRIORITY_LABEL, STATUS_LABEL, STATUS_ORDER, STATUS_TONE, TYPE_LABEL } from '../../lib/labels'
import { formatDateTime, formatRelative } from '../../lib/format'
import { fullName } from '../../lib/lookups'
import { CITIZEN_STATUS_LABEL, EXPLAINED_STATUSES } from '../../lib/requests'
import { useNow } from '../../lib/useNow'
import { CitizenCard } from '../../shared/CitizenCard'
import { LinkedHistory } from '../../shared/EntityHistory'
import { RequestTimeline } from '../../shared/RequestTimeline'
import { toast } from '../../stores/toastStore'
import { PriorityTag, Ref, StatusPill, Tag } from '../../ui/Badges'
import { Button, ButtonLink } from '../../ui/Button'
import { ErrorSummary } from '../../ui/ErrorSummary'
import { Field, FilterChips, Select, TextArea, Toggle } from '../../ui/Controls'
import { EmptyState, Skeleton } from '../../ui/Feedback'
import { Icon } from '../../ui/Icon'
import { PageHeader } from '../../ui/PageHeader'
import { Panel } from '../../ui/Panel'
import { stagger } from '../../ui/motion'
import layout from '../../ui/layout.module.css'
import styles from './agent.module.css'

const TONE_VAR: Record<string, string> = {
  ember: 'var(--color-ember)',
  taken: 'var(--color-taken)',
  progress: 'var(--color-progress)',
  neutral: 'var(--color-text-muted)',
  ok: 'var(--color-ok)',
  alert: 'var(--color-alert)',
}

/** Procedure answers kept for the screens, not shown as raw fields */
const HIDDEN_DATA = new Set(['urgency_hint', 'map_point'])
const URGENCY_HINT: Record<string, string> = { low: 'Peu urgent', normal: 'Normale', high: 'Urgente', urgent: 'Très urgente' }

const isExplained = (status: RequestStatus) => (EXPLAINED_STATUSES as readonly string[]).includes(status)

/** D11 / F22 / F25 / F49 / D04: process one request and see its full history. */
export default function RequestDetailPage() {
  const { id } = useParams()
  const persona = usePersona()
  const base = persona === 'ADMIN' ? '/admin' : '/agent'
  const query = useRequest(Number(id))
  const request = query.data

  if (!request) {
    if (!query.isError) return <Skeleton lines={8} />
    const missing = toApiError(query.error).status === 404
    return (
      <EmptyState title={missing ? 'Demande introuvable' : messageFor(query.error)} icon="inbox">
        {missing && 'Cette référence n’existe pas ou a été supprimée. '}
        <ButtonLink to={`${base}/demandes`}>Retour à la file</ButtonLink>
      </EmptyState>
    )
  }
  // key: a fresh form for each request
  return <RequestWorkspace key={request.id} request={request} base={base} />
}

function RequestWorkspace({ request, base }: { request: RequestDetail; base: string }) {
  const actor = useActor()
  const now = useNow()
  const update = useUpdateRequest()
  const comment = useAddComment()
  const staff = useStaff().data ?? []
  const load = new Map((useDashboardStats().data?.requests.open_by_agent ?? []).map((row) => [row.agent.id, row.count]))
  const citizen = useUser(request.citizen_id).data
  const others = useRequests({ citizen_id: request.citizen_id ?? undefined, limit: 6, sort: 'newest' }, request.citizen_id !== null).data

  const [nextStatus, setNextStatus] = useState<RequestStatus | null>(null)
  const [note, setNote] = useState('')
  const [internal, setInternal] = useState(false)
  const [asCitizen, setAsCitizen] = useState(false)

  const target = nextStatus ?? request.status
  const changed = target !== request.status
  const explained = changed && isExplained(target)
  // An explained change is always public (F49)
  const internalNote = internal && !explained
  const hasAccount = request.citizen_id !== null
  const busy = update.isPending || comment.isPending

  const form = useApiForm({
    labels: { note: 'Message pour l’habitant' },
    validate: (): Record<string, string> =>
      explained && !note.trim() ? { note: 'Ce changement doit être expliqué à l’habitant : dites ce qu’il doit faire ou ce qui a été fait.' } : {},
    submit: async () => {
      const message = note.trim()
      if (changed) {
        const result = await update.mutateAsync({ id: request.id, status: target, note: message || undefined, internal_note: internalNote })
        return { kind: 'status' as const, notified: result.citizen_notified }
      }
      await comment.mutateAsync({ id: request.id, message, is_internal: internalNote })
      return { kind: 'note' as const, notified: hasAccount && !internalNote }
    },
    onSuccess: ({ kind, notified }) => {
      const what = kind === 'status' ? `${request.reference} → ${STATUS_LABEL[target]}` : `Message ajouté à ${request.reference}`
      const who = notified
        ? 'habitant prévenu'
        : internalNote
          ? 'note interne, l’habitant ne la voit pas'
          : hasAccount
            ? 'habitant non prévenu'
            : 'pas de compte : répondez par e-mail'
      toast(`${what} · ${who}`, notified || internalNote ? 'ok' : 'info')
      setNote('')
      setNextStatus(null)
      setInternal(false)
    },
  })

  const run = (changes: Parameters<typeof update.mutate>[0], done: string) =>
    update.mutate(changes, { onSuccess: () => toast(done), onError: (error) => toast(messageFor(error), 'alert') })

  const mine = request.assigned_agent_id === actor.id
  const takeOver = () => run({ id: request.id, assigned_agent_id: actor.id }, `${request.reference} prise en charge`)
  const urgencyHint = typeof request.data?.urgency_hint === 'string' ? request.data.urgency_hint : null
  const data = Object.entries(request.data ?? {}).filter(([key]) => !HIDDEN_DATA.has(key))
  const contactEmail = citizen?.email ?? request.citizen?.email ?? request.contact_email
  const mailto = contactEmail
    ? `mailto:${contactEmail}?subject=${encodeURIComponent(`[${request.reference}] ${request.subject}`)}`
    : null

  return (
    <motion.div className={layout.page} variants={stagger} initial="hidden" animate="show">
      <PageHeader
        title={request.subject}
        codes={['D11', 'F22', 'F49', request.type === 'INCIDENT' ? 'F25' : request.type === 'CONTACT' ? 'D04' : 'F26']}
        lead={
          <span className={layout.row}>
            <Ref>{request.reference}</Ref>
            <StatusPill status={request.status} />
            <PriorityTag priority={request.priority} />
            <Tag tone="neutral">{TYPE_LABEL[request.type]}</Tag>
            <span>reçue {formatRelative(request.created_at, now)}</span>
          </span>
        }
        actions={
          <>
            {!mine && NEEDS_ACTION.includes(request.status) && (
              <Button variant="primary" icon="zap" onClick={takeOver} disabled={busy}>
                Prendre en charge
              </Button>
            )}
            <ButtonLink to={`${base}/demandes`} icon="chevronLeft" variant="ghost">
              File
            </ButtonLink>
          </>
        }
      />

      <div className={[layout.grid, layout.splitWide].join(' ')}>
        <div className={layout.stack}>
          <Panel kicker="Contenu" title="Ce que dit l’habitant" accent={request.priority === 'URGENT' && NEEDS_ACTION.includes(request.status) ? 'alert' : undefined}>
            <p className={styles.detailMessage}>{request.message}</p>
            {request.procedure && <p className={layout.sectionLabel}>Démarche : {request.procedure.title}</p>}
            {data.length > 0 && (
              <div className={styles.dataList}>
                {data.map(([key, value]) => (
                  <div key={key}>
                    <span>{key.replace(/_/g, ' ')}</span>
                    <strong>{typeof value === 'string' || typeof value === 'number' ? value : JSON.stringify(value)}</strong>
                  </div>
                ))}
              </div>
            )}
            {request.attachment && request.type !== 'INCIDENT' && (
              <a className={styles.attachment} href={`${imgUrl}${request.attachment}`} target="_blank" rel="noreferrer">
                <Icon name="file" size={16} /> Pièce jointe : {request.attachment}
              </a>
            )}
            <dl className={layout.dl}>
              <dt>Service</dt>
              <dd>{request.service?.name ?? '—'}</dd>
              <dt>Créée le</dt>
              <dd>{formatDateTime(request.created_at)}</dd>
              <dt>Mise à jour</dt>
              <dd>{formatRelative(request.updated_at, now)}</dd>
            </dl>
          </Panel>

          {request.type === 'INCIDENT' && (
            <Panel kicker="F25 · Signalement" title={request.location_label ?? 'Localisation'}>
              {request.attachment && (
                <img className={styles.reportPhoto} src={`${imgUrl}${request.attachment}`} alt={`Photo jointe au signalement ${request.reference}`} />
              )}
              <dl className={layout.dl}>
                <dt>Lieu</dt>
                <dd>{request.location_label ?? '—'}</dd>
                <dt>Quartier</dt>
                <dd>{request.district?.name ?? '—'}</dd>
                <dt>Position</dt>
                <dd>
                  {request.latitude !== null && request.longitude !== null ? (
                    <a href={`https://www.openstreetmap.org/?mlat=${request.latitude}&mlon=${request.longitude}#map=18/${request.latitude}/${request.longitude}`} target="_blank" rel="noreferrer">
                      {request.latitude.toFixed(4)}, {request.longitude.toFixed(4)}
                    </a>
                  ) : (
                    '—'
                  )}
                </dd>
              </dl>
              {request.category && (
                <div className={layout.row}>
                  <Tag tone="ember">{request.category}</Tag>
                </div>
              )}
            </Panel>
          )}

          <Panel
            kicker="D11 · F26"
            title={asCitizen ? 'Historique vu par l’habitant' : 'Historique de la demande'}
            actions={
              <Toggle checked={asCitizen} onChange={setAsCitizen} label="Voir comme l’habitant" />
            }
          >
            {asCitizen && !hasAccount && <p className={layout.sectionLabel}>Sans compte, ce visiteur ne voit pas ce suivi : il ne reçoit que vos e-mails.</p>}
            <RequestTimeline request={request} asCitizen={asCitizen} />
          </Panel>
        </div>

        <div className={layout.stack}>
          <Panel kicker="D11 · F49 · Traitement" title="Faire évoluer la demande" accent="ice">
            <form
              className={layout.stack}
              noValidate
              onSubmit={(e) => {
                e.preventDefault()
                void form.handleSubmit(undefined)
              }}
            >
              <ErrorSummary id={form.summaryId} errors={form.summary} formError={form.formError} />
              <div className={styles.statusGrid} role="group" aria-label="Nouvel état">
                {STATUS_ORDER.map((status) => (
                  <button
                    key={status}
                    type="button"
                    className={styles.statusOption}
                    style={{ ['--tone' as string]: TONE_VAR[STATUS_TONE[status]] }}
                    aria-pressed={target === status}
                    onClick={() => {
                      setNextStatus(status)
                      form.clearError('note')
                    }}
                  >
                    {STATUS_LABEL[status]}
                  </button>
                ))}
              </div>
              <Field
                id={form.fieldId('note')}
                label={changed ? `Message pour le passage à « ${STATUS_LABEL[target]} »` : 'Message ou note'}
                required={explained}
                error={form.errors.note}
                hint={
                  explained
                    ? 'Obligatoire : dites ce que l’habitant doit faire ou ce qui a été fait.'
                    : internalNote
                      ? 'Note interne : visible uniquement par le personnel, aucune notification.'
                      : hasAccount
                        ? 'L’habitant recevra ce message dans ses notifications.'
                        : 'Visiteur sans compte : il ne reçoit pas de notification, répondez-lui par e-mail.'
                }
              >
                {(fieldId, describedBy, invalid) => (
                  <TextArea
                    id={fieldId}
                    aria-describedby={describedBy}
                    aria-invalid={invalid}
                    aria-required={explained}
                    value={note}
                    onChange={(e) => {
                      setNote(e.target.value)
                      form.clearError('note')
                    }}
                    placeholder="Ex. : une équipe interviendra demain matin."
                  />
                )}
              </Field>
              <Toggle
                checked={internalNote}
                onChange={setInternal}
                disabled={explained}
                label={explained ? 'Note interne (impossible : ce changement doit être expliqué à l’habitant)' : 'Note interne (jamais notifiée, invisible pour l’habitant)'}
              />

              {(changed || (note.trim() && !internalNote)) && (
                <div className={styles.notifyPreview} aria-live="polite">
                  <p className={layout.sectionLabel}>
                    <Icon name="bell" size={13} /> {hasAccount ? 'Notification qui partira' : 'Aucune notification : visiteur sans compte'}
                  </p>
                  {hasAccount && (
                    <>
                      <p className={layout.strong}>
                        {changed
                          ? `Demande ${request.reference} : ${CITIZEN_STATUS_LABEL[target]}`
                          : `Nouveau message sur la demande ${request.reference}`}
                      </p>
                      {note.trim() && !internalNote && <p>{note.trim()}</p>}
                    </>
                  )}
                </div>
              )}

              <Button type="submit" variant="primary" icon={changed ? 'check' : 'send'} disabled={form.pending || (!changed && !note.trim())} aria-busy={form.pending}>
                {changed ? `Passer en « ${STATUS_LABEL[target]} »` : 'Envoyer'}
              </Button>
            </form>

            <hr className={layout.divider} />
            <Field label="Assignée à" hint="Entre parenthèses : demandes ouvertes déjà confiées à chacun.">
              {(fieldId, describedBy) => (
                <Select
                  id={fieldId}
                  aria-describedby={describedBy}
                  value={request.assigned_agent_id ?? ''}
                  disabled={busy}
                  onChange={(e) => {
                    const agentId = e.target.value ? Number(e.target.value) : null
                    const who = staff.find((member) => member.id === agentId)
                    run({ id: request.id, assigned_agent_id: agentId }, agentId ? `${request.reference} assignée à ${fullName(who)}` : `${request.reference} n’est plus assignée`)
                  }}
                >
                  <option value="">Non assignée</option>
                  {staff.map((member) => (
                    <option key={member.id} value={member.id}>
                      {fullName(member)}
                      {member.id === actor.id ? ' (moi)' : ''} ({load.get(member.id) ?? 0})
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <p className={layout.sectionLabel}>Priorité</p>
            <FilterChips<RequestPriority>
              label="Priorité"
              value={request.priority}
              onChange={(p) => run({ id: request.id, priority: p }, `${request.reference} : priorité ${PRIORITY_LABEL[p].toLowerCase()}`)}
              options={(['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const).map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))}
            />
            {urgencyHint && (
              <p className={layout.sectionLabel}>
                Urgence proposée par l’habitant : {URGENCY_HINT[urgencyHint] ?? urgencyHint}
              </p>
            )}
          </Panel>

          <Panel kicker="F34 · D04 · Informations utiles" title={hasAccount ? 'Habitant' : 'Contact'}>
            {hasAccount ? (
              citizen ? (
                <CitizenCard citizen={citizen} requests={others?.meta.total} />
              ) : (
                <p className={layout.strong}>{fullName(request.citizen ?? undefined)}</p>
              )
            ) : (
              <dl className={layout.dl}>
                <dt>Nom</dt>
                <dd>{request.contact_name ?? '—'}</dd>
                <dt>E-mail</dt>
                <dd>{request.contact_email ?? '—'}</dd>
                <dt>Compte</dt>
                <dd>{request.contact_email || request.contact_name ? 'Visiteur sans compte (D04)' : 'Compte supprimé'}</dd>
              </dl>
            )}
            {mailto && (
              <div className={layout.row}>
                <a className={styles.mailLink} href={mailto}>
                  <Icon name="send" size={15} /> Répondre par e-mail
                </a>
                {!hasAccount && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      comment.mutate(
                        { id: request.id, message: 'Répondu par e-mail.', is_internal: true },
                        { onSuccess: () => toast('Note interne ajoutée : répondu par e-mail'), onError: (error) => toast(messageFor(error), 'alert') },
                      )
                    }
                  >
                    Noter « Répondu par e-mail »
                  </Button>
                )}
              </div>
            )}
            {others && others.data.filter((r) => r.id !== request.id).length > 0 && (
              <>
                <p className={layout.sectionLabel}>Ses autres demandes</p>
                <ul className={styles.oldest}>
                  {others.data
                    .filter((r) => r.id !== request.id)
                    .slice(0, 5)
                    .map((r) => (
                      <li key={r.id}>
                        <Ref>{r.reference}</Ref>
                        <Link to={`${base}/demandes/${r.id}`} className={styles.oldestSubject}>
                          {r.subject}
                        </Link>
                        <StatusPill status={r.status} />
                      </li>
                    ))}
                </ul>
              </>
            )}
          </Panel>
        </div>
      </div>

      <Panel kicker="F48" title="Historique des modifications">
        <LinkedHistory entity="CitizenRequest" match={request.reference} />
      </Panel>
    </motion.div>
  )
}
