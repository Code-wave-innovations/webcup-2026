import { useState } from 'react'
import { motion } from 'motion/react'
import { messageFor } from '../../../api/errors'
import { useDeleteInterruption, useEndInterruption, useInterruptions, useSaveInterruption } from '../../../api/interruptions'
import { useAdminServices } from '../../../api/services'
import type { ServiceInterruption } from '../../../api/types'
import { useApiForm } from '../../../hooks/useApiForm'
import { usePersona } from '../../layout/persona'
import { IMPACT_LABEL, INTERRUPTION_TYPE_LABEL } from '../../lib/labels'
import { formatDateTime, formatRelative, fromLocalInput, toLocalInput } from '../../lib/format'
import { useNow } from '../../lib/useNow'
import { EntityHistory } from '../../shared/EntityHistory'
import { ServicesStatus } from '../../shared/ServiceState'
import { toast } from '../../stores/toastStore'
import { Tag } from '../../ui/Badges'
import { Button } from '../../ui/Button'
import { ErrorSummary } from '../../ui/ErrorSummary'
import { Field, FilterChips, Select, TextArea, TextInput } from '../../ui/Controls'
import { EmptyState, Skeleton } from '../../ui/Feedback'
import { Drawer, Modal } from '../../ui/Overlay'
import { PageHeader } from '../../ui/PageHeader'
import { Panel } from '../../ui/Panel'
import { stagger } from '../../ui/motion'
import layout from '../../ui/layout.module.css'
import styles from './admin.module.css'

const DAY = 86_400_000
type Type = ServiceInterruption['type']
type Impact = ServiceInterruption['impact']

/** F38: planned maintenance and incidents on a 7-day frise, with what citizens should do instead (agents and admins). */
export default function MaintenancePage() {
  const now = useNow()
  const persona = usePersona()
  const all = useInterruptions('all')
  const services = useAdminServices()
  const end = useEndInterruption()
  const remove = useDeleteInterruption()
  const [editing, setEditing] = useState<ServiceInterruption | 'new' | null>(null)
  const [history, setHistory] = useState<ServiceInterruption | null>(null)

  const list = all.data ?? []
  const windowStart = now - DAY
  const windowEnd = now + 6 * DAY
  const pct = (ms: number) => `${Math.min(100, Math.max(0, ((ms - windowStart) / (windowEnd - windowStart)) * 100))}%`
  const ended = (iso: string | null) => iso !== null && new Date(iso).getTime() <= now
  const active = list.filter((i) => !ended(i.ends_at)).sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  const past = list.filter((i) => ended(i.ends_at))
  const ticks = Array.from({ length: 8 }, (_, i) => new Date(windowStart + i * DAY))

  const act = (promise: Promise<unknown>, done: string) => promise.then(() => toast(done), (error) => toast(messageFor(error), 'alert'))

  return (
    <motion.div className={layout.page} variants={stagger} initial="hidden" animate="show">
      <PageHeader
        title="Interruptions de service"
        codes={['F38', 'F64']}
        lead="Annoncez une maintenance ou un incident : les habitants voient l’indisponibilité avant de commencer une démarche, quand revenir et quoi faire à la place."
        actions={
          <Button variant="primary" icon="plus" onClick={() => setEditing('new')}>
            Déclarer une interruption
          </Button>
        }
      />

      {persona === 'ADMIN' && (
        <Panel kicker="F64 · En ce moment" title="État des services">
          {services.data ? <ServicesStatus services={services.data} /> : <Skeleton lines={2} />}
        </Panel>
      )}

      <Panel kicker="7 jours" title="Frise des interruptions" aria-busy={all.isFetching}>
        {!all.data ? (
          all.isError ? <EmptyState title={messageFor(all.error)} icon="alert" /> : <Skeleton lines={4} />
        ) : active.length === 0 ? (
          <EmptyState title="Tous les services fonctionnent, aucune interruption prévue" icon="check" />
        ) : (
          <div className={styles.gantt}>
            <div className={styles.ganttScale}>
              <span />
              <span className={styles.ganttTicks}>
                {ticks.map((t) => (
                  <span key={t.toISOString()}>{t.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}</span>
                ))}
              </span>
            </div>
            {active.map((i) => {
              const start = new Date(i.starts_at).getTime()
              const stop = i.ends_at ? new Date(i.ends_at).getTime() : windowEnd
              const color = i.impact === 'UNAVAILABLE' ? 'var(--color-alert)' : 'var(--color-progress)'
              return (
                <div key={i.id} className={styles.ganttRow}>
                  <span className={styles.ganttLabel}>{i.service.name}</span>
                  <span className={styles.ganttTrack}>
                    <motion.span
                      className={styles.ganttBar}
                      style={{ left: pct(start), width: `calc(${pct(stop)} - ${pct(start)})`, background: color, originX: 0 }}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
                    >
                      {IMPACT_LABEL[i.impact]}
                    </motion.span>
                    <span className={styles.ganttNow} style={{ left: pct(now) }} aria-hidden="true" />
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </Panel>

      <div className={[layout.grid, layout.cols2].join(' ')}>
        {active.map((i) => {
          const ongoing = new Date(i.starts_at).getTime() <= now
          return (
            <Panel
              key={i.id}
              kicker={`${INTERRUPTION_TYPE_LABEL[i.type]} · ${ongoing ? 'en cours' : `à venir, ${formatRelative(i.starts_at, now)}`}`}
              title={i.service.name}
              accent={ongoing && i.impact === 'UNAVAILABLE' ? 'alert' : ongoing ? 'ember' : undefined}
              actions={
                <span className={layout.row}>
                  {ongoing ? (
                    <Button size="sm" icon="check" disabled={end.isPending} onClick={() => void act(end.mutateAsync(i.id), `${i.service.name} rétabli`)}>
                      Service rétabli
                    </Button>
                  ) : (
                    <Button size="sm" variant="danger" disabled={remove.isPending} onClick={() => void act(remove.mutateAsync(i.id), 'Interruption annulée')}>
                      Annuler
                    </Button>
                  )}
                  <Button size="sm" variant="subtle" icon="edit" onClick={() => setEditing(i)}>
                    Modifier
                  </Button>
                </span>
              }
            >
              <div className={layout.row}>
                <Tag tone={i.impact === 'UNAVAILABLE' ? 'alert' : 'progress'} pulse={ongoing}>
                  {IMPACT_LABEL[i.impact]}
                </Tag>
                <span className={[layout.muted, layout.small].join(' ')}>
                  {formatDateTime(i.starts_at)} → {i.ends_at ? formatDateTime(i.ends_at) : 'jusqu’à nouvel ordre'}
                </span>
              </div>
              <p>{i.reason}</p>
              {i.alternative && (
                <div className={styles.preview}>
                  <span className={styles.previewLabel}>Message aux habitants</span>
                  <p className={layout.small}>
                    <strong>En attendant :</strong> {i.alternative}
                  </p>
                </div>
              )}
              <Button size="sm" variant="ghost" icon="scroll" onClick={() => setHistory(i)}>
                Historique
              </Button>
            </Panel>
          )
        })}
      </div>

      {past.length > 0 && (
        <Panel kicker="Historique" title="Interruptions terminées">
          <ul className={styles.sectionList}>
            {past.slice(0, 20).map((i) => (
              <li key={i.id} className={styles.sectionItem}>
                <Tag tone="neutral">{INTERRUPTION_TYPE_LABEL[i.type]}</Tag>
                <span />
                <span>
                  {i.service.name} — {i.reason}
                </span>
                <small className={layout.muted}>{i.ends_at && formatRelative(i.ends_at, now)}</small>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {editing && <InterruptionForm key={editing === 'new' ? 'new' : editing.id} interruption={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}

      <Drawer open={history !== null} onClose={() => setHistory(null)} kicker="F48" title={history ? `Historique · ${history.service.name}` : ''}>
        {history && <EntityHistory entity="ServiceInterruption" entityId={history.id} />}
      </Drawer>
    </motion.div>
  )
}

function InterruptionForm({ interruption, onClose }: { interruption: ServiceInterruption | null; onClose: () => void }) {
  const now = useNow()
  const services = useAdminServices().data ?? []
  const save = useSaveInterruption()
  const [serviceId, setServiceId] = useState(interruption?.service_id ?? services[0]?.id ?? 0)
  const [type, setType] = useState<Type>(interruption?.type ?? 'MAINTENANCE')
  const [impact, setImpact] = useState<Impact>(interruption?.impact ?? 'UNAVAILABLE')
  const [reason, setReason] = useState(interruption?.reason ?? '')
  const [alternative, setAlternative] = useState(interruption?.alternative ?? '')
  const [starts, setStarts] = useState(toLocalInput(interruption?.starts_at ?? new Date(now).toISOString()))
  const [ends, setEnds] = useState(toLocalInput(interruption?.ends_at ?? new Date(now + 4 * 3_600_000).toISOString()))

  const form = useApiForm({
    labels: { service_id: 'Service', reason: 'Motif', alternative: 'Alternative', starts_at: 'Début', ends_at: 'Fin' },
    validate: (): Record<string, string> => {
      const errors: Record<string, string> = {}
      if (!serviceId) errors.service_id = 'Choisissez un service.'
      if (reason.trim().length < 3) errors.reason = 'Dites ce qui se passe.'
      if (!starts) errors.starts_at = 'Indiquez le début.'
      if (starts && ends && new Date(ends) <= new Date(starts)) errors.ends_at = 'La fin doit être après le début.'
      return errors
    },
    submit: () =>
      save.mutateAsync({
        id: interruption?.id,
        ...(interruption ? {} : { service_id: serviceId }),
        type,
        impact,
        reason: reason.trim(),
        alternative: alternative.trim() || null,
        starts_at: fromLocalInput(starts) ?? undefined,
        ends_at: fromLocalInput(ends),
      }),
    onSuccess: (saved) => {
      const name = services.find((s) => s.id === saved.service_id)?.name ?? 'Service'
      toast(
        interruption
          ? `Interruption de ${name} modifiée`
          : `${name} : interruption publiée · ${saved.notified ?? 0} habitant${(saved.notified ?? 0) > 1 ? 's' : ''} prévenu${(saved.notified ?? 0) > 1 ? 's' : ''}`,
      )
      onClose()
    },
  })

  return (
    <Modal
      open
      onClose={onClose}
      kicker="F38"
      title={interruption ? 'Modifier l’interruption' : 'Déclarer une interruption'}
      footer={
        <>
          <Button variant="subtle" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" icon="wrench" type="submit" form="interruption-form" disabled={form.pending} aria-busy={form.pending}>
            {interruption ? 'Enregistrer' : 'Publier'}
          </Button>
        </>
      }
    >
      <form
        id="interruption-form"
        noValidate
        className={layout.stack}
        onSubmit={(e) => {
          e.preventDefault()
          void form.handleSubmit(undefined)
        }}
      >
        <ErrorSummary id={form.summaryId} errors={form.summary} formError={form.formError} />
        <Field id={form.fieldId('service_id')} label="Service concerné" required error={form.errors.service_id}>
          {(id) => (
            <Select id={id} data-autofocus value={serviceId} disabled={interruption !== null} onChange={(e) => setServiceId(Number(e.target.value))}>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className={layout.row}>
          <FilterChips<Type> label="Type" value={type} onChange={setType} options={[{ value: 'MAINTENANCE', label: 'Maintenance' }, { value: 'INCIDENT', label: 'Incident' }]} />
          <FilterChips<Impact> label="Impact" value={impact} onChange={setImpact} options={[{ value: 'UNAVAILABLE', label: 'Indisponible' }, { value: 'DEGRADED', label: 'Perturbé' }]} />
        </div>
        <Field id={form.fieldId('reason')} label="Motif (visible des habitants)" required error={form.errors.reason}>
          {(id, describedBy, invalid) => <TextArea id={id} aria-describedby={describedBy} aria-invalid={invalid} value={reason} onChange={(e) => setReason(e.target.value)} />}
        </Field>
        <Field id={form.fieldId('alternative')} label="Que faire à la place ?" hint="Autre guichet, numéro d’urgence, date de retour…" error={form.errors.alternative}>
          {(id, describedBy, invalid) => <TextInput id={id} aria-describedby={describedBy} aria-invalid={invalid} value={alternative} onChange={(e) => setAlternative(e.target.value)} />}
        </Field>
        <div className={layout.formGrid}>
          <Field id={form.fieldId('starts_at')} label="Début" required error={form.errors.starts_at}>
            {(id, describedBy, invalid) => <TextInput id={id} type="datetime-local" aria-describedby={describedBy} aria-invalid={invalid} value={starts} onChange={(e) => setStarts(e.target.value)} />}
          </Field>
          <Field id={form.fieldId('ends_at')} label="Fin (vide = jusqu’à nouvel ordre)" error={form.errors.ends_at}>
            {(id, describedBy, invalid) => <TextInput id={id} type="datetime-local" aria-describedby={describedBy} aria-invalid={invalid} value={ends} onChange={(e) => setEnds(e.target.value)} />}
          </Field>
        </div>
        {impact === 'UNAVAILABLE' && (
          <p className={[layout.muted, layout.small].join(' ')}>Les nouvelles demandes et réservations seront refusées pendant la période ; les habitants qui ont un rendez-vous sont prévenus.</p>
        )}
      </form>
    </Modal>
  )
}
