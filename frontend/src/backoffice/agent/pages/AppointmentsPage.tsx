import { useState } from 'react'
import { motion } from 'motion/react'
import { useAppointments, useStaffSlots, useUpdateAppointment } from '../../../api/appointments'
import { messageFor } from '../../../api/errors'
import type { Appointment, AppointmentStatus } from '../../../api/types'
import { nextDays } from '../../../lib/cityTime'
import { useActor } from '../../layout/persona'
import { APPOINTMENT_LABEL, APPOINTMENT_TONE } from '../../lib/labels'
import { formatDateTime } from '../../lib/format'
import { useNow } from '../../lib/useNow'
import { toast } from '../../stores/toastStore'
import { Ref, Tag } from '../../ui/Badges'
import { Button } from '../../ui/Button'
import { Field, FilterChips, TextArea } from '../../ui/Controls'
import { EmptyState, Skeleton } from '../../ui/Feedback'
import { Drawer } from '../../ui/Overlay'
import { PageHeader } from '../../ui/PageHeader'
import { Panel } from '../../ui/Panel'
import { StatTile } from '../../ui/StatTile'
import { stagger } from '../../ui/motion'
import layout from '../../ui/layout.module.css'
import shared from '../../shared/shared.module.css'

const TONE_VAR: Record<string, string> = {
  ice: 'var(--color-ice)',
  ok: 'var(--color-ok)',
  alert: 'var(--color-alert)',
  neutral: 'var(--color-text-muted)',
  progress: 'var(--color-progress)',
  taken: 'var(--color-taken)',
  ember: 'var(--color-ember)',
}

const DAY_FORMAT = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })

/** F40: what the resident chose, and whether it went */
function reminderText(appointment: Appointment) {
  const { offset_minutes, sent_at, scheduled_for } = appointment.reminder
  if (offset_minutes === null) return 'Aucun rappel (choix de l’habitant)'
  const when = offset_minutes >= 1440 ? 'La veille' : `${Math.round(offset_minutes / 60)} h avant`
  return sent_at ? `${when} · envoyé le ${formatDateTime(sent_at)}` : `${when} · prévu le ${formatDateTime(scheduled_for!)}`
}

/**
 * F39 / F40: the agent's agenda with the residents, bound to the API. Days and hours are the city's
 * (as the resident read them when booking); a click opens the appointment to prepare it, mark the
 * presence (« Absent » only once it has started) and keep a note the resident never sees.
 */
export default function AppointmentsPage() {
  const actor = useActor()
  const now = useNow()
  const [scope, setScope] = useState<'mine' | 'all'>('mine')
  const [days, setDays] = useState(5)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  // the period is fixed per day (not per second), so the queries do not change at every tick
  const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const keysProbe = nextDays(now, browserZone, 1)[0].key
  const from = new Date(Date.parse(`${keysProbe}T00:00:00Z`) - 86_400_000).toISOString()
  const to = new Date(Date.parse(`${keysProbe}T00:00:00Z`) + (days + 1) * 86_400_000).toISOString()

  const slots = useStaffSlots({ from, to, ...(scope === 'mine' ? { agent_id: actor.id } : {}) })
  const appointments = useAppointments({ scope: 'all', mine: scope === 'mine', from, to, limit: 100 })
  const update = useUpdateAppointment()

  const timeZone = slots.data?.[0]?.time_zone ?? appointments.data?.data[0]?.when.time_zone ?? browserZone
  const dayKeys = nextDays(now, timeZone, days)
  const visibleDays = new Set(dayKeys.map((d) => d.key))
  const visibleSlots = (slots.data ?? []).filter((s) => visibleDays.has(s.day))
  const visible = (appointments.data?.data ?? []).filter((a) => visibleDays.has(a.when.day))
  const times = [...new Set(visibleSlots.map((s) => s.start_time).concat(visible.map((a) => a.when.start_time)))].sort()
  const selected = visible.find((a) => a.id === selectedId) ?? appointments.data?.data.find((a) => a.id === selectedId)
  const today = dayKeys[0]?.key
  const todayCount = visible.filter((a) => a.status === 'BOOKED' && a.when.day === today).length

  const setStatus = (appointment: Appointment, status: AppointmentStatus) =>
    update.mutate(
      { id: appointment.id, status },
      {
        onSuccess: () => toast(`${appointment.reference} : ${APPOINTMENT_LABEL[status].toLowerCase()}`, status === 'NO_SHOW' ? 'alert' : 'ok'),
        onError: (error) => toast(messageFor(error), 'alert'),
      },
    )

  return (
    <motion.div className={layout.page} variants={stagger} initial="hidden" animate="show">
      <PageHeader
        title="Rendez-vous"
        codes={['F39', 'F40']}
        lead="Votre agenda avec les habitants, à l’heure de Terra Nova. Cliquez sur un rendez-vous pour le préparer, indiquer la présence et noter."
      />

      <motion.div className={layout.stats} variants={stagger}>
        <StatTile label="Aujourd’hui" value={todayCount} icon="calendar" tone="ice" />
        <StatTile label="À venir" value={visible.filter((a) => a.status === 'BOOKED').length} icon="clock" tone="taken" />
        <StatTile label="Honorés" value={visible.filter((a) => a.status === 'COMPLETED').length} icon="check" tone="ok" />
        <StatTile label="Absences" value={visible.filter((a) => a.status === 'NO_SHOW').length} icon="alert" tone="alert" />
      </motion.div>

      <Panel
        kicker="Agenda"
        title={scope === 'mine' ? 'Mes créneaux' : 'Tous les créneaux'}
        flush
        actions={
          <>
            <FilterChips<'mine' | 'all'> label="Créneaux affichés" value={scope} onChange={setScope} options={[{ value: 'mine', label: 'Les miens' }, { value: 'all', label: 'Tous' }]} />
            <FilterChips<number> label="Période" value={days} onChange={setDays} options={[{ value: 1, label: 'Jour' }, { value: 5, label: '5 jours' }, { value: 7, label: 'Semaine' }]} />
          </>
        }
      >
        {slots.isError || appointments.isError ? (
          <EmptyState title={messageFor(slots.error ?? appointments.error)} icon="alert" />
        ) : slots.isPending || appointments.isPending ? (
          <Skeleton lines={8} />
        ) : times.length === 0 ? (
          <EmptyState title={scope === 'mine' ? 'Aucun créneau à votre nom sur la période' : 'Aucun créneau sur la période'} icon="calendar" />
        ) : (
          <div className={shared.agenda} style={{ ['--days' as string]: days }} role="grid" aria-label="Agenda des rendez-vous">
            <div className={shared.agendaHead} role="columnheader" aria-label="Heure" />
            {dayKeys.map((d) => (
              <div key={d.key} role="columnheader" className={[shared.agendaHead, d.key === today && shared.agendaToday].filter(Boolean).join(' ')}>
                {d.key === today ? 'Aujourd’hui' : DAY_FORMAT.format(new Date(`${d.key}T12:00:00Z`))}
              </div>
            ))}
            {times.map((time) => (
              <div key={time} style={{ display: 'contents' }} role="row">
                <div className={shared.agendaTime} role="rowheader">
                  {time}
                </div>
                {dayKeys.map((d) => {
                  const cellSlots = visibleSlots.filter((s) => s.day === d.key && s.start_time === time)
                  const cell = visible.filter((a) => a.when.day === d.key && a.when.start_time === time)
                  const free = cellSlots.reduce((sum, s) => sum + Math.max(0, s.remaining), 0)
                  return (
                    <div key={d.key} className={shared.agendaCell} role="gridcell">
                      {cell.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          className={shared.appt}
                          style={{ ['--tone' as string]: TONE_VAR[APPOINTMENT_TONE[a.status]] }}
                          onClick={() => setSelectedId(a.id)}
                          aria-label={`${time}, ${a.citizen ? `${a.citizen.name} ${a.citizen.last_name}` : 'Compte supprimé'}, ${a.service.name}, ${APPOINTMENT_LABEL[a.status]}`}
                        >
                          <strong>{a.citizen ? `${a.citizen.name} ${a.citizen.last_name}` : 'Compte supprimé'}</strong>
                          <small>
                            {a.service.name} · {APPOINTMENT_LABEL[a.status]}
                          </small>
                        </button>
                      ))}
                      {free > 0 && (
                        <span className={shared.freeSlot}>
                          {free} libre{free > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Drawer
        open={!!selected}
        onClose={() => setSelectedId(null)}
        kicker={selected?.reference}
        title={selected ? selected.service.name : ''}
        footer={
          selected && (
            <>
              <Button
                variant="danger"
                icon="close"
                disabled={update.isPending || selected.status === 'NO_SHOW' || Date.parse(selected.when.starts_at) > now}
                title={Date.parse(selected.when.starts_at) > now ? 'Disponible une fois le rendez-vous commencé' : undefined}
                onClick={() => setStatus(selected, 'NO_SHOW')}
              >
                Absent
              </Button>
              <Button variant="primary" icon="check" disabled={update.isPending || selected.status === 'COMPLETED'} onClick={() => setStatus(selected, 'COMPLETED')}>
                Honoré
              </Button>
            </>
          )
        }
      >
        {selected && <AppointmentDetails key={selected.id} appointment={selected} />}
      </Drawer>
    </motion.div>
  )
}

function AppointmentDetails({ appointment }: { appointment: Appointment }) {
  const update = useUpdateAppointment()
  const [notes, setNotes] = useState(appointment.agent_notes ?? '')
  const documents = [...appointment.preparation.bring, ...appointment.preparation.required_documents.map(String)]
  return (
    <>
      <div className={layout.row}>
        <Ref>{appointment.reference}</Ref>
        <Tag tone={APPOINTMENT_TONE[appointment.status]}>{APPOINTMENT_LABEL[appointment.status]}</Tag>
      </div>
      <dl className={layout.dl}>
        <dt>Créneau</dt>
        <dd>
          {appointment.when.label} ({appointment.when.time_zone})
        </dd>
        <dt>Lieu</dt>
        <dd>{appointment.where.location}</dd>
        <dt>Motif</dt>
        <dd>{appointment.reason}</dd>
        {appointment.procedure && (
          <>
            <dt>Démarche</dt>
            <dd>{appointment.procedure.title}</dd>
          </>
        )}
        <dt>Rappel (F40)</dt>
        <dd>{reminderText(appointment)}</dd>
        <dt>À apporter</dt>
        <dd>{documents.join(' · ') || '—'}</dd>
        <dt>Consignes</dt>
        <dd>{appointment.preparation.notes ?? '—'}</dd>
      </dl>
      <p className={layout.sectionLabel}>Habitant</p>
      {appointment.citizen ? (
        <dl className={layout.dl}>
          <dt>Nom</dt>
          <dd>
            {appointment.citizen.name} {appointment.citizen.last_name}
          </dd>
          <dt>E-mail</dt>
          <dd>{appointment.citizen.email}</dd>
          <dt>Téléphone</dt>
          <dd>{appointment.citizen.phone ?? '—'}</dd>
        </dl>
      ) : (
        <p className={layout.muted}>Compte supprimé : le rendez-vous reste dans l’historique.</p>
      )}
      <Field label="Note de l’agent" hint="Jamais visible de l’habitant.">
        {(id, describedBy) => <TextArea id={id} aria-describedby={describedBy} value={notes} onChange={(e) => setNotes(e.target.value)} />}
      </Field>
      <Button
        icon="check"
        disabled={update.isPending || notes === (appointment.agent_notes ?? '')}
        onClick={() =>
          update.mutate(
            { id: appointment.id, agent_notes: notes.trim() || null },
            { onSuccess: () => toast('Note enregistrée'), onError: (error) => toast(messageFor(error), 'alert') },
          )
        }
      >
        Enregistrer la note
      </Button>
    </>
  )
}
