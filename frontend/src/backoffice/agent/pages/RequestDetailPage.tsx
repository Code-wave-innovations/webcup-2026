import { useState } from 'react'
import { useParams } from 'react-router'
import { motion } from 'motion/react'
import { useActor, usePersona } from '../../layout/persona'
import { NEEDS_ACTION, PRIORITY_LABEL, STATUS_LABEL, STATUS_ORDER, STATUS_TONE, TYPE_LABEL } from '../../lib/labels'
import { formatDateTime, formatRelative } from '../../lib/format'
import { districtName, fullName, useServiceName, useUsersById } from '../../lib/lookups'
import { useNow } from '../../lib/useNow'
import type { RequestPriority, RequestStatus } from '../../mocks/types'
import { CitizenCard } from '../../shared/CitizenCard'
import { RequestTimeline } from '../../shared/RequestTimeline'
import { useAppointmentStore } from '../../stores/appointmentStore'
import { addComment, assignRequest, changeStatus, setPriority, useRequestStore } from '../../stores/requestStore'
import { PriorityTag, Ref, StatusPill, Tag } from '../../ui/Badges'
import { Button, ButtonLink } from '../../ui/Button'
import { Field, FilterChips, Select, TextArea, Toggle } from '../../ui/Controls'
import { EmptyState } from '../../ui/Feedback'
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

/** D11 / F22 / F25 / F26 / F34: process one request and see its full history. */
export default function RequestDetailPage() {
  const { id } = useParams()
  const actor = useActor()
  const persona = usePersona()
  const now = useNow()
  const users = useUsersById()
  const serviceName = useServiceName()
  const request = useRequestStore((s) => s.requests.find((r) => String(r.id) === id))
  const allRequests = useRequestStore((s) => s.requests)
  const appointments = useAppointmentStore((s) => s.appointments)

  const [nextStatus, setNextStatus] = useState<RequestStatus | null>(null)
  const [note, setNote] = useState('')
  const [internal, setInternal] = useState(false)
  const base = persona === 'ADMIN' ? '/admin' : '/agent'

  if (!request) {
    return (
      <EmptyState title="Demande introuvable" icon="inbox">
        Cette référence n’existe pas ou a été supprimée. <ButtonLink to={`${base}/demandes`}>Retour à la file</ButtonLink>
      </EmptyState>
    )
  }

  const citizen = request.citizen_id ? users.get(request.citizen_id) : undefined
  const agents = [...users.values()].filter((u) => u.role !== 'CITIZEN' && u.is_active)
  const target = nextStatus ?? request.status
  const changed = target !== request.status

  const submit = () => {
    if (changed) changeStatus(request.id, target, actor.id, note.trim() || undefined, internal)
    else if (note.trim()) addComment(request.id, note.trim(), actor.id, internal)
    setNote('')
    setNextStatus(null)
  }

  // pseudo-position of the incident on the stylised map
  const pin = request.latitude !== null && request.longitude !== null
    ? { x: `${20 + ((request.longitude * 1000) % 60)}%`, y: `${20 + ((Math.abs(request.latitude) * 1000) % 55)}%` }
    : null

  return (
    <motion.div className={layout.page} variants={stagger} initial="hidden" animate="show">
      <PageHeader
        title={request.subject}
        codes={['D11', 'F22', request.type === 'INCIDENT' ? 'F25' : 'F26']}
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
          <ButtonLink to={`${base}/demandes`} icon="chevronLeft" variant="ghost">
            File
          </ButtonLink>
        }
      />

      <div className={[layout.grid, layout.splitWide].join(' ')}>
        <div className={layout.stack}>
          <Panel kicker="Contenu" title="Ce que dit le citoyen" accent={request.priority === 'URGENT' && NEEDS_ACTION.includes(request.status) ? 'alert' : undefined}>
            <p className={styles.detailMessage}>{request.message}</p>
            {request.procedure_title && (
              <>
                <p className={layout.sectionLabel}>Démarche : {request.procedure_title}</p>
                {request.data && (
                  <div className={styles.dataList}>
                    {Object.entries(request.data).map(([key, value]) => (
                      <div key={key}>
                        <span>{key.replace(/_/g, ' ')}</span>
                        <strong>{value}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            {request.attachment && (
              <span className={styles.attachment}>
                <Icon name="file" size={16} /> {request.attachment}
              </span>
            )}
            <dl className={layout.dl}>
              <dt>Service</dt>
              <dd>{serviceName(request.service_id)}</dd>
              <dt>Créée le</dt>
              <dd>{formatDateTime(request.created_at)}</dd>
              <dt>Mise à jour</dt>
              <dd>{formatRelative(request.updated_at, now)}</dd>
            </dl>
          </Panel>

          {request.type === 'INCIDENT' && (
            <Panel kicker="F25 · Signalement" title={request.location_label ?? 'Localisation'}>
              <div className={styles.mapBox} style={pin ? ({ ['--x' as string]: pin.x, ['--y' as string]: pin.y }) : undefined} role="img" aria-label={`Localisation : ${request.location_label ?? 'non précisée'}`}>
                {pin && <span className={styles.pin} />}
                <span className={styles.coords}>
                  {request.latitude?.toFixed(3)} · {request.longitude?.toFixed(3)} — {districtName(request.district_id)}
                </span>
              </div>
              <div className={layout.row}>
                {request.category && <Tag tone="ember">{request.category}</Tag>}
                <Tag tone="neutral">{districtName(request.district_id)}</Tag>
              </div>
            </Panel>
          )}

          <Panel kicker="D11 · F26 · F48" title="Historique de la demande">
            <RequestTimeline request={request} />
          </Panel>
        </div>

        <div className={layout.stack}>
          <Panel kicker="D11 · Traitement" title="Faire évoluer la demande" accent="ice">
            <div className={styles.statusGrid} role="group" aria-label="Nouvel état">
              {STATUS_ORDER.map((status) => (
                <button
                  key={status}
                  type="button"
                  className={styles.statusOption}
                  style={{ ['--tone' as string]: TONE_VAR[STATUS_TONE[status]] }}
                  aria-pressed={target === status}
                  onClick={() => setNextStatus(status)}
                >
                  {STATUS_LABEL[status]}
                </button>
              ))}
            </div>
            <Field label={changed ? `Message pour le passage à « ${STATUS_LABEL[target]} »` : 'Message ou note'} hint={internal ? 'Visible uniquement par les agents.' : 'Le citoyen sera notifié.'}>
              {(fieldId, describedBy) => (
                <TextArea id={fieldId} aria-describedby={describedBy} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. : une équipe interviendra demain matin." />
              )}
            </Field>
            <Toggle checked={internal} onChange={setInternal} label="Note interne (non visible du citoyen)" />
            <Button variant="primary" icon={changed ? 'check' : 'send'} onClick={submit} disabled={!changed && !note.trim()}>
              {changed ? `Passer en « ${STATUS_LABEL[target]} »` : 'Envoyer'}
            </Button>
            <hr className={layout.divider} />
            <Field label="Assignée à">
              {(fieldId) => (
                <Select
                  id={fieldId}
                  value={request.assigned_agent_id ?? ''}
                  onChange={(e) => assignRequest(request.id, e.target.value ? Number(e.target.value) : null, actor.id)}
                >
                  <option value="">Non assignée</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {fullName(a)}
                      {a.id === actor.id ? ' (moi)' : ''}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <p className={layout.sectionLabel}>Priorité</p>
            <FilterChips<RequestPriority>
              label="Priorité"
              value={request.priority}
              onChange={(p) => setPriority(request.id, p, actor.id)}
              options={(['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const).map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))}
            />
          </Panel>

          <Panel kicker="F34 · Informations utiles" title={citizen ? 'Citoyen' : 'Contact'}>
            {citizen ? (
              <CitizenCard
                citizen={citizen}
                requests={allRequests.filter((r) => r.citizen_id === citizen.id).length}
                appointments={appointments.filter((a) => a.citizen_id === citizen.id).length}
              />
            ) : (
              <dl className={layout.dl}>
                <dt>Nom</dt>
                <dd>{request.contact_name ?? '—'}</dd>
                <dt>E-mail</dt>
                <dd>{request.contact_email ?? '—'}</dd>
                <dt>Compte</dt>
                <dd>Visiteur sans compte (D04)</dd>
              </dl>
            )}
          </Panel>
        </div>
      </div>
    </motion.div>
  )
}
