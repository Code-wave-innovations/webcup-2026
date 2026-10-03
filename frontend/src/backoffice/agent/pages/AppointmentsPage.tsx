import { useState } from 'react'
import { motion } from 'motion/react'
import { useActor } from '../../layout/persona'
import { APPOINTMENT_LABEL, APPOINTMENT_TONE } from '../../lib/labels'
import { formatSlot } from '../../lib/format'
import { fullName, useServiceName, useUsersById } from '../../lib/lookups'
import { useNow } from '../../lib/useNow'
import type { Appointment } from '../../mocks/types'
import { AppointmentAgenda } from '../../shared/AppointmentAgenda'
import { CitizenCard } from '../../shared/CitizenCard'
import { saveAgentNotes, setAppointmentStatus, useAppointmentStore } from '../../stores/appointmentStore'
import { Ref, Tag } from '../../ui/Badges'
import { Button } from '../../ui/Button'
import { Field, FilterChips, TextArea } from '../../ui/Controls'
import { Drawer } from '../../ui/Overlay'
import { PageHeader } from '../../ui/PageHeader'
import { Panel } from '../../ui/Panel'
import { StatTile } from '../../ui/StatTile'
import { stagger } from '../../ui/motion'
import layout from '../../ui/layout.module.css'

/** F39: the agent's appointments with citizens, and what to prepare. */
export default function AppointmentsPage() {
  const actor = useActor()
  const now = useNow()
  const users = useUsersById()
  const serviceName = useServiceName()
  const slots = useAppointmentStore((s) => s.slots)
  const appointments = useAppointmentStore((s) => s.appointments)
  const [scope, setScope] = useState<'mine' | 'all'>('mine')
  const [days, setDays] = useState(5)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [notes, setNotes] = useState('')

  const visibleSlots = scope === 'mine' ? slots.filter((s) => s.agent_id === actor.id) : slots
  const slotIds = new Set(visibleSlots.map((s) => s.id))
  const visible = appointments.filter((a) => slotIds.has(a.slot_id))
  const selected = appointments.find((a) => a.id === selectedId)
  const slot = selected ? slots.find((s) => s.id === selected.slot_id) : undefined
  const citizen = selected?.citizen_id ? users.get(selected.citizen_id) : undefined
  const today = new Date(now).toDateString()
  const todayCount = visible.filter((a) => a.status === 'BOOKED' && new Date(slots.find((s) => s.id === a.slot_id)?.starts_at ?? 0).toDateString() === today).length

  const open = (a: Appointment) => {
    setSelectedId(a.id)
    setNotes(a.agent_notes ?? '')
  }

  return (
    <motion.div className={layout.page} variants={stagger} initial="hidden" animate="show">
      <PageHeader simulated title="Rendez-vous" codes={['F39', 'F40']} lead="Votre agenda avec les citoyens. Cliquez sur un rendez-vous pour le préparer ou indiquer sa présence." />

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
            <FilterChips<number> label="Période" value={days} onChange={setDays} options={[{ value: 1, label: 'Jour' }, { value: 5, label: 'Semaine' }]} />
          </>
        }
      >
        <AppointmentAgenda slots={visibleSlots} appointments={visible} days={days} onSelect={open} />
      </Panel>

      <Drawer
        open={!!selected}
        onClose={() => setSelectedId(null)}
        kicker={selected?.reference}
        title={selected ? serviceName(selected.service_id) : ''}
        footer={
          selected && (
            <>
              <Button variant="danger" icon="close" onClick={() => setAppointmentStatus(selected.id, 'NO_SHOW', actor.id)}>
                Absent
              </Button>
              <Button variant="primary" icon="check" onClick={() => setAppointmentStatus(selected.id, 'COMPLETED', actor.id)}>
                Honoré
              </Button>
            </>
          )
        }
      >
        {selected && slot && (
          <>
            <div className={layout.row}>
              <Ref>{selected.reference}</Ref>
              <Tag tone={APPOINTMENT_TONE[selected.status]}>{APPOINTMENT_LABEL[selected.status]}</Tag>
            </div>
            <dl className={layout.dl}>
              <dt>Créneau</dt>
              <dd>{formatSlot(slot.starts_at, slot.ends_at)}</dd>
              <dt>Lieu</dt>
              <dd>{slot.location}</dd>
              <dt>Motif</dt>
              <dd>{selected.reason}</dd>
              <dt>Rappel (F40)</dt>
              <dd>{selected.reminder_offset_minutes >= 1440 ? `${selected.reminder_offset_minutes / 1440} j` : `${selected.reminder_offset_minutes} min`} avant</dd>
              <dt>À préparer</dt>
              <dd>{slot.preparation_notes ?? '—'}</dd>
            </dl>
            {citizen && (
              <>
                <p className={layout.sectionLabel}>Citoyen</p>
                <CitizenCard citizen={citizen} />
              </>
            )}
            <Field label="Note de l’agent" hint="Jamais visible du citoyen.">
              {(id, describedBy) => <TextArea id={id} aria-describedby={describedBy} value={notes} onChange={(e) => setNotes(e.target.value)} />}
            </Field>
            <Button icon="check" onClick={() => saveAgentNotes(selected.id, notes, actor.id)}>
              Enregistrer la note
            </Button>
            <p className={[layout.muted, layout.small].join(' ')}>Agent : {fullName(slot.agent_id ? users.get(slot.agent_id) : undefined)}</p>
          </>
        )}
      </Drawer>
    </motion.div>
  )
}
