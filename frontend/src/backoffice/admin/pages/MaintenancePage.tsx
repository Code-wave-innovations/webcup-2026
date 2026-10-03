import { useState } from 'react'
import { motion } from 'motion/react'
import { useActor } from '../../layout/persona'
import { IMPACT_LABEL, INTERRUPTION_TYPE_LABEL } from '../../lib/labels'
import { formatDateTime, formatRelative } from '../../lib/format'
import { useServiceName } from '../../lib/lookups'
import { useNow } from '../../lib/useNow'
import type { InterruptionImpact, InterruptionType } from '../../mocks/types'
import { addInterruption, endInterruption, useCatalogStore } from '../../stores/catalogStore'
import { Tag } from '../../ui/Badges'
import { Button } from '../../ui/Button'
import { Field, FilterChips, Select, TextArea, TextInput } from '../../ui/Controls'
import { EmptyState } from '../../ui/Feedback'
import { Modal } from '../../ui/Overlay'
import { PageHeader } from '../../ui/PageHeader'
import { Panel } from '../../ui/Panel'
import { stagger } from '../../ui/motion'
import layout from '../../ui/layout.module.css'
import styles from './admin.module.css'

const DAY = 86_400_000
const toLocalInput = (ms: number) => {
  const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60_000)
  return d.toISOString().slice(0, 16)
}

/** F38: planned maintenance and incidents, on a 7-day frise, with what citizens should do instead. */
export default function MaintenancePage() {
  const actor = useActor()
  const now = useNow()
  const serviceName = useServiceName()
  const services = useCatalogStore((s) => s.services)
  const interruptions = useCatalogStore((s) => s.interruptions)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    service_id: services[0]?.id ?? 1,
    type: 'MAINTENANCE' as InterruptionType,
    impact: 'UNAVAILABLE' as InterruptionImpact,
    reason: '',
    alternative: '',
    starts: '',
    ends: '',
  })

  const windowStart = now - DAY
  const windowEnd = now + 6 * DAY
  const pct = (ms: number) => `${Math.min(100, Math.max(0, ((ms - windowStart) / (windowEnd - windowStart)) * 100))}%`
  const ended = (end: string | null) => end !== null && new Date(end).getTime() <= now
  const active = interruptions.filter((i) => !ended(i.ends_at)).sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  const past = interruptions.filter((i) => ended(i.ends_at))
  const ticks = Array.from({ length: 8 }, (_, i) => new Date(windowStart + i * DAY))

  const openForm = () => {
    setForm((f) => ({ ...f, starts: toLocalInput(now), ends: toLocalInput(now + 4 * 3_600_000) }))
    setCreating(true)
  }

  return (
    <motion.div className={layout.page} variants={stagger} initial="hidden" animate="show">
      <PageHeader simulated
        title="Interruptions de service"
        codes={['F38']}
        lead="Annoncez une maintenance ou un incident : les habitants voient l’indisponibilité avant de commencer une démarche, quand revenir et quoi faire à la place."
        actions={
          <Button variant="primary" icon="plus" onClick={openForm}>
            Déclarer une interruption
          </Button>
        }
      />

      <Panel kicker="7 jours" title="Frise des interruptions">
        {active.length === 0 ? (
          <EmptyState title="Tous les services fonctionnent" icon="check" />
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
              const end = i.ends_at ? new Date(i.ends_at).getTime() : windowEnd
              const color = i.impact === 'UNAVAILABLE' ? 'var(--color-alert)' : 'var(--color-progress)'
              return (
                <div key={i.id} className={styles.ganttRow}>
                  <span className={styles.ganttLabel}>{serviceName(i.service_id)}</span>
                  <span className={styles.ganttTrack}>
                    <motion.span
                      className={styles.ganttBar}
                      style={{ left: pct(start), width: `calc(${pct(end)} - ${pct(start)})`, background: color, originX: 0 }}
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
              kicker={`${INTERRUPTION_TYPE_LABEL[i.type]} · ${ongoing ? 'en cours' : `dans ${formatRelative(i.starts_at, now).replace('dans ', '')}`}`}
              title={serviceName(i.service_id)}
              accent={ongoing && i.impact === 'UNAVAILABLE' ? 'alert' : ongoing ? 'ember' : undefined}
              actions={
                ongoing && (
                  <Button size="sm" icon="check" onClick={() => endInterruption(i.id, actor.id)}>
                    Service rétabli
                  </Button>
                )
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
            </Panel>
          )
        })}
      </div>

      {past.length > 0 && (
        <Panel kicker="Historique" title="Interruptions terminées">
          <ul className={styles.sectionList}>
            {past.map((i) => (
              <li key={i.id} className={styles.sectionItem}>
                <Tag tone="neutral">{INTERRUPTION_TYPE_LABEL[i.type]}</Tag>
                <span />
                <span>
                  {serviceName(i.service_id)} — {i.reason}
                </span>
                <small className={layout.muted}>{i.ends_at && formatRelative(i.ends_at, now)}</small>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        kicker="F38"
        title="Déclarer une interruption"
        footer={
          <>
            <Button variant="subtle" onClick={() => setCreating(false)}>
              Annuler
            </Button>
            <Button
              variant="primary"
              icon="wrench"
              disabled={form.reason.trim().length < 3 || !form.starts}
              onClick={() => {
                addInterruption(
                  {
                    service_id: form.service_id,
                    type: form.type,
                    impact: form.impact,
                    reason: form.reason.trim(),
                    alternative: form.alternative.trim() || null,
                    starts_at: new Date(form.starts).toISOString(),
                    ends_at: form.ends ? new Date(form.ends).toISOString() : null,
                  },
                  actor.id,
                )
                setCreating(false)
              }}
            >
              Publier
            </Button>
          </>
        }
      >
        <Field label="Service concerné">
          {(id) => (
            <Select id={id} data-autofocus value={form.service_id} onChange={(e) => setForm({ ...form, service_id: Number(e.target.value) })}>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className={layout.row}>
          <FilterChips<InterruptionType> label="Type" value={form.type} onChange={(type) => setForm({ ...form, type })} options={[{ value: 'MAINTENANCE', label: 'Maintenance' }, { value: 'INCIDENT', label: 'Incident' }]} />
          <FilterChips<InterruptionImpact> label="Impact" value={form.impact} onChange={(impact) => setForm({ ...form, impact })} options={[{ value: 'UNAVAILABLE', label: 'Indisponible' }, { value: 'DEGRADED', label: 'Dégradé' }]} />
        </div>
        <Field label="Raison (visible des habitants)">{(id) => <TextArea id={id} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />}</Field>
        <Field label="Que faire à la place ?" hint="Autre guichet, numéro d’urgence, date de retour…">
          {(id, d) => <TextInput id={id} aria-describedby={d} value={form.alternative} onChange={(e) => setForm({ ...form, alternative: e.target.value })} />}
        </Field>
        <div className={layout.formGrid}>
          <Field label="Début">{(id) => <TextInput id={id} type="datetime-local" value={form.starts} onChange={(e) => setForm({ ...form, starts: e.target.value })} />}</Field>
          <Field label="Fin (vide = jusqu’à nouvel ordre)">{(id) => <TextInput id={id} type="datetime-local" value={form.ends} onChange={(e) => setForm({ ...form, ends: e.target.value })} />}</Field>
        </div>
        {form.impact === 'UNAVAILABLE' && <p className={[layout.muted, layout.small].join(' ')}>Les nouvelles demandes et réservations sur ce service seront bloquées pendant la période.</p>}
      </Modal>
    </motion.div>
  )
}
