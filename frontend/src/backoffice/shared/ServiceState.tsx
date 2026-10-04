import { useState } from 'react'
import { Link } from 'react-router'
import { isApiError, messageFor } from '../../api/errors'
import { useDisableService, useServiceImpact } from '../../api/services'
import { usePersona } from '../layout/persona'
import type { Availability, CityService } from '../../api/types'
import { useApiForm } from '../../hooks/useApiForm'
import { formatDateTime, formatTime, fromLocalInput, toLocalInput } from '../lib/format'
import { toast } from '../stores/toastStore'
import { Button } from '../ui/Button'
import { ErrorSummary } from '../ui/ErrorSummary'
import { Field, FilterChips, TextArea, TextInput, Toggle } from '../ui/Controls'
import { Skeleton } from '../ui/Feedback'
import { Icon } from '../ui/Icon'
import { Modal } from '../ui/Overlay'
import layout from '../ui/layout.module.css'
import styles from './shared.module.css'

const sameDay = (iso: string) => new Date(iso).toDateString() === new Date().toDateString()
const when = (iso: string) => (sameDay(iso) ? formatTime(iso) : formatDateTime(iso))

/** F64: the state of a service, with an icon and a word (never a colour alone) */
export function AvailabilityPill({ availability }: { availability: Availability }) {
  const { status, back_at, upcoming } = availability
  const text =
    status === 'UNAVAILABLE'
      ? `Indisponible${back_at ? ` jusqu’à ${when(back_at)}` : ''}`
      : status === 'DEGRADED'
        ? `Perturbé${back_at ? ` jusqu’à ${when(back_at)}` : ''}`
        : upcoming.length
          ? 'Disponible · maintenance prévue'
          : 'Disponible'
  return (
    <span className={[styles.statePill, styles[`state${status}`]].join(' ')}>
      <Icon name={status === 'AVAILABLE' ? 'check' : status === 'DEGRADED' ? 'alert' : 'close'} size={13} />
      {text}
    </span>
  )
}

/** F64: the state card of a service exactly as the citizen reads it on its page */
export function ServicePreview({ service }: { service: CityService }) {
  const { status, current, back_at, upcoming } = service.availability
  return (
    <div className={[styles.preview, styles[`state${status}`]].join(' ')} aria-label="Aperçu de ce que voit l’habitant">
      <p className={styles.previewTitle}>{service.name}</p>
      {status === 'AVAILABLE' ? (
        <p>
          <Icon name="check" size={14} /> Service disponible{service.opening_hours ? ` · ${service.opening_hours}` : ''}
        </p>
      ) : (
        <>
          <p className={layout.strong}>
            <Icon name={status === 'UNAVAILABLE' ? 'close' : 'alert'} size={14} /> {status === 'UNAVAILABLE' ? 'Indisponible' : 'Service perturbé'}
            {current ? ` depuis ${when(current.starts_at)}` : ''}
            {back_at ? ` · Retour prévu ${sameDay(back_at) ? 'à' : 'le'} ${when(back_at)}` : ' · Jusqu’à nouvel ordre'}
          </p>
          {current?.reason && <p>{current.reason}</p>}
          {current?.alternative && <p>En attendant : {current.alternative}</p>}
          {status === 'UNAVAILABLE' && <p className={layout.small}>Les nouvelles démarches et prises de rendez-vous sont suspendues.</p>}
        </>
      )}
      {upcoming.map((i) => (
        <p key={i.id} className={layout.small}>
          <Icon name="clock" size={13} /> {i.type === 'MAINTENANCE' ? 'Maintenance prévue' : 'Interruption prévue'} le {formatDateTime(i.starts_at)}
          {i.ends_at ? ` jusqu’à ${when(i.ends_at)}` : ''}
        </p>
      ))}
    </div>
  )
}

const REASONS = ['Panne technique', 'Incident en cours', 'Fermeture exceptionnelle']

/**
 * F63: cut a faulty service in three clicks — open, say why, cut. It stays visible as
 * « Indisponible » with the reason, the alternative and the return time.
 */
export function CutServiceModal({ service, onClose }: { service: CityService | null; onClose: () => void }) {
  return service ? <CutForm key={service.id} service={service} onClose={onClose} /> : null
}

function CutForm({ service, onClose }: { service: CityService; onClose: () => void }) {
  const impact = useServiceImpact(service.id).data
  const disable = useDisableService()
  const [reason, setReason] = useState('')
  const [alternative, setAlternative] = useState(service.contact_phone ? `Appelez le ${service.contact_phone}` : '')
  const [backAt, setBackAt] = useState('')
  const [notifyRequests, setNotifyRequests] = useState(false)

  const form = useApiForm({
    labels: { reason: 'Motif', alternative: 'Alternative', back_at: 'Retour estimé' },
    validate: (): Record<string, string> => (reason.trim().length < 3 ? { reason: 'Dites pourquoi le service est coupé.' } : {}),
    describeError: (error) => (isApiError(error) && error.status === 403 ? 'Seul un administrateur peut couper un service.' : null),
    submit: () =>
      disable.mutateAsync({
        id: service.id,
        reason: reason.trim(),
        alternative: alternative.trim() || null,
        back_at: fromLocalInput(backAt),
        notify_open_requests: notifyRequests,
      }),
    onSuccess: (result) => {
      toast(`${service.name} coupé · ${result.notified} habitant${result.notified > 1 ? 's' : ''} prévenu${result.notified > 1 ? 's' : ''}`, 'alert')
      onClose()
    },
  })

  return (
    <Modal
      open
      onClose={onClose}
      kicker="F63 · Coupure d’urgence"
      title={`Couper « ${service.name} »`}
      footer={
        <>
          <Button variant="subtle" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="danger" icon="power" type="submit" form="cut-service" disabled={form.pending} aria-busy={form.pending}>
            Couper maintenant
          </Button>
        </>
      }
    >
      <form
        id="cut-service"
        noValidate
        className={layout.stack}
        onSubmit={(e) => {
          e.preventDefault()
          void form.handleSubmit(undefined)
        }}
      >
        <ErrorSummary id={form.summaryId} errors={form.summary} formError={form.formError} />
        {impact ? (
          <p className={styles.impact}>
            <Icon name="alert" size={15} /> {impact.upcoming_appointments} rendez-vous à venir · {impact.open_requests} demande{impact.open_requests > 1 ? 's' : ''} ouverte
            {impact.open_requests > 1 ? 's' : ''} · {impact.open_procedures} démarche{impact.open_procedures > 1 ? 's' : ''} en ligne. Les habitants qui ont un rendez-vous pendant la coupure sont prévenus.
          </p>
        ) : (
          <Skeleton lines={1} />
        )}
        <FilterChips<string> label="Modèles de motif" value={REASONS.includes(reason) ? reason : ''} onChange={setReason} options={REASONS.map((r) => ({ value: r, label: r }))} />
        <Field id={form.fieldId('reason')} label="Motif" required error={form.errors.reason} hint="Affiché à l’habitant sur la fiche du service.">
          {(id, describedBy, invalid) => (
            <TextArea id={id} data-autofocus aria-describedby={describedBy} aria-invalid={invalid} aria-required value={reason} onChange={(e) => setReason(e.target.value)} />
          )}
        </Field>
        <Field id={form.fieldId('alternative')} label="En attendant, que faire ?" error={form.errors.alternative}>
          {(id, describedBy, invalid) => <TextInput id={id} aria-describedby={describedBy} aria-invalid={invalid} value={alternative} onChange={(e) => setAlternative(e.target.value)} />}
        </Field>
        <Field id={form.fieldId('back_at')} label="Retour estimé (facultatif)" error={form.errors.back_at} hint="Sans heure : « jusqu’à nouvel ordre ».">
          {(id, describedBy, invalid) => (
            <TextInput id={id} type="datetime-local" aria-describedby={describedBy} aria-invalid={invalid} value={backAt} min={toLocalInput(new Date().toISOString())} onChange={(e) => setBackAt(e.target.value)} />
          )}
        </Field>
        <Toggle checked={notifyRequests} onChange={setNotifyRequests} label={`Prévenir aussi les habitants des demandes ouvertes${impact ? ` (${impact.open_requests})` : ''}`} />
        {disable.isError && !form.formError && <p role="alert">{messageFor(disable.error)}</p>}
      </form>
    </Modal>
  )
}

/** F64: how many services work, are disturbed or are down, and the ones to watch with their return time */
export function ServicesStatus({ services }: { services: CityService[] }) {
  const admin = usePersona() === 'ADMIN'
  const active = services.filter((s) => s.is_active)
  const count = (status: Availability['status']) => active.filter((s) => s.availability.status === status).length
  const down = active.filter((s) => s.availability.status !== 'AVAILABLE')
  return (
    <div className={layout.stack}>
      <p className={layout.row}>
        <span className={[styles.statePill, styles.stateAVAILABLE].join(' ')}>
          <Icon name="check" size={13} /> {count('AVAILABLE')} disponible{count('AVAILABLE') > 1 ? 's' : ''}
        </span>
        <span className={[styles.statePill, styles.stateDEGRADED].join(' ')}>
          <Icon name="alert" size={13} /> {count('DEGRADED')} perturbé{count('DEGRADED') > 1 ? 's' : ''}
        </span>
        <span className={[styles.statePill, styles.stateUNAVAILABLE].join(' ')}>
          <Icon name="close" size={13} /> {count('UNAVAILABLE')} indisponible{count('UNAVAILABLE') > 1 ? 's' : ''}
        </span>
      </p>
      {down.length > 0 && (
        <ul className={layout.stack} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {down.map((s) => (
            <li key={s.id} className={layout.row}>
              <AvailabilityPill availability={s.availability} />
              {admin ? <Link to={`/admin/services?service=${s.id}`}>{s.name}</Link> : <span>{s.name}</span>}
              {s.availability.current?.reason && <span className={[layout.muted, layout.small].join(' ')}>{s.availability.current.reason}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
