import { useState } from 'react'
import { motion } from 'motion/react'
import { fullName, useUsersById } from '../../lib/lookups'
import { useNow } from '../../lib/useNow'
import type { Appointment } from '../../mocks/types'
import { AppointmentAgenda } from '../../shared/AppointmentAgenda'
import { addSlots, useAppointmentStore } from '../../stores/appointmentStore'
import { useCatalogStore } from '../../stores/catalogStore'
import { toast } from '../../stores/toastStore'
import { Button } from '../../ui/Button'
import { Field, Select, TextInput } from '../../ui/Controls'
import { PageHeader } from '../../ui/PageHeader'
import { Panel } from '../../ui/Panel'
import { StatTile } from '../../ui/StatTile'
import { stagger } from '../../ui/motion'
import layout from '../../ui/layout.module.css'

const WEEKDAYS = [
  { iso: 1, label: 'L', name: 'Lundi' },
  { iso: 2, label: 'M', name: 'Mardi' },
  { iso: 3, label: 'M', name: 'Mercredi' },
  { iso: 4, label: 'J', name: 'Jeudi' },
  { iso: 5, label: 'V', name: 'Vendredi' },
  { iso: 6, label: 'S', name: 'Samedi' },
]

const dateInput = (ms: number) => new Date(ms - new Date(ms).getTimezoneOffset() * 60_000).toISOString().slice(0, 10)

/** F39: publish appointment slots in series, by service and agent. */
export default function SlotsPage() {
  const now = useNow()
  const users = useUsersById()
  const services = useCatalogStore((s) => s.services)
  const slots = useAppointmentStore((s) => s.slots)
  const appointments = useAppointmentStore((s) => s.appointments)
  const agents = [...users.values()].filter((u) => u.role !== 'CITIZEN' && u.is_active)
  const [serviceFilter, setServiceFilter] = useState<number | ''>('')
  const [form, setForm] = useState(() => ({
    service_id: 1,
    agent_id: 2 as number | null,
    location: 'Hôtel de ville — guichet 1',
    capacity: 1,
    from: '',
    to: '',
    start: '14:00',
    end: '16:00',
    duration: 30,
    weekdays: [1, 2, 3, 4, 5],
  }))

  const from = form.from || dateInput(now + 86_400_000 * 7)
  const to = form.to || dateInput(now + 86_400_000 * 11)
  const dates: string[] = []
  for (let d = new Date(`${from}T00:00:00`); d <= new Date(`${to}T00:00:00`) && dates.length < 62; d.setDate(d.getDate() + 1)) {
    const iso = d.getDay() === 0 ? 7 : d.getDay()
    if (form.weekdays.includes(iso)) dates.push(dateInput(d.getTime()))
  }
  const [sh, sm] = form.start.split(':').map(Number)
  const [eh, em] = form.end.split(':').map(Number)
  const perDay = Math.max(0, Math.floor((eh * 60 + em - (sh * 60 + sm)) / form.duration))
  const preview = perDay * dates.length

  const visibleSlots = serviceFilter ? slots.filter((s) => s.service_id === serviceFilter) : slots
  const futureSlots = slots.filter((s) => new Date(s.starts_at).getTime() > now)
  const booked = appointments.filter((a) => a.status === 'BOOKED').length
  const capacity = futureSlots.reduce((sum, s) => sum + s.capacity, 0)

  return (
    <motion.div className={layout.page} variants={stagger} initial="hidden" animate="show">
      <PageHeader simulated title="Créneaux de rendez-vous" codes={['F39', 'F40']} lead="Publiez des créneaux en série. Chaque créneau indique le lieu, l’agent et ce que le citoyen doit préparer." />

      <motion.div className={layout.stats} variants={stagger}>
        <StatTile label="Créneaux à venir" value={futureSlots.length} icon="calendar" tone="ice" />
        <StatTile label="Places réservées" value={booked} icon="users" tone="taken" />
        <StatTile label="Taux de remplissage" value={Math.round((booked / Math.max(1, capacity)) * 100)} unit="%" icon="activity" tone="progress" />
      </motion.div>

      <div className={[layout.grid, layout.split].join(' ')}>
        <Panel
          kicker="Semaine"
          title="Agenda des services"
          flush
          actions={
            <Select aria-label="Service" value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Tous les services</option>
              {services
                .filter((s) => slots.some((slot) => slot.service_id === s.id))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </Select>
          }
        >
          <AppointmentAgenda
            slots={visibleSlots}
            appointments={appointments}
            days={5}
            onSelect={(a: Appointment) => toast(`${a.reference} — ${a.reason}`, 'info')}
          />
        </Panel>

        <Panel kicker="Générateur" title="Publier une série" accent="ice">
          <Field label="Service">
            {(id) => (
              <Select id={id} value={form.service_id} onChange={(e) => setForm({ ...form, service_id: Number(e.target.value) })}>
                {services.filter((s) => s.is_active).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Agent">
            {(id) => (
              <Select id={id} value={form.agent_id ?? ''} onChange={(e) => setForm({ ...form, agent_id: e.target.value ? Number(e.target.value) : null })}>
                <option value="">N’importe quel agent</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {fullName(a)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Lieu">{(id) => <TextInput id={id} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />}</Field>
          <div className={layout.formGrid}>
            <Field label="Du">{(id) => <TextInput id={id} type="date" value={from} onChange={(e) => setForm({ ...form, from: e.target.value })} />}</Field>
            <Field label="Au">{(id) => <TextInput id={id} type="date" value={to} onChange={(e) => setForm({ ...form, to: e.target.value })} />}</Field>
            <Field label="De">{(id) => <TextInput id={id} type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />}</Field>
            <Field label="À">{(id) => <TextInput id={id} type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />}</Field>
            <Field label="Durée (min)">
              {(id) => <TextInput id={id} type="number" min={5} step={5} value={form.duration} onChange={(e) => setForm({ ...form, duration: Math.max(5, Number(e.target.value)) })} />}
            </Field>
            <Field label="Places par créneau">
              {(id) => <TextInput id={id} type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Math.max(1, Number(e.target.value)) })} />}
            </Field>
          </div>
          <div className={layout.row} role="group" aria-label="Jours de la semaine">
            {WEEKDAYS.map((d) => (
              <Button
                key={d.iso}
                size="sm"
                style={{ width: 40, padding: 0 }}
                variant={form.weekdays.includes(d.iso) ? 'primary' : 'ghost'}
                aria-pressed={form.weekdays.includes(d.iso)}
                aria-label={d.name}
                onClick={() => setForm((f) => ({ ...f, weekdays: f.weekdays.includes(d.iso) ? f.weekdays.filter((w) => w !== d.iso) : [...f.weekdays, d.iso] }))}
              >
                {d.label}
              </Button>
            ))}
          </div>
          <p className={layout.small}>
            <strong>{preview}</strong> créneau{preview > 1 ? 'x' : ''} seront publiés ({perDay} par jour sur {dates.length} jour{dates.length > 1 ? 's' : ''}).
          </p>
          <Button
            variant="primary"
            icon="plus"
            disabled={preview === 0}
            onClick={() => addSlots({ service_id: form.service_id, agent_id: form.agent_id, location: form.location, capacity: form.capacity, dates, start: form.start, end: form.end, duration: form.duration })}
          >
            Publier les créneaux
          </Button>
        </Panel>
      </div>
    </motion.div>
  )
}
