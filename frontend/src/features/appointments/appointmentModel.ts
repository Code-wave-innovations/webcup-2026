import type { AppointmentSlot, AppointmentStatus } from '../../api/types'

/*
  F39 / F40: no doubt about the chosen slot. Every day and time is the city's (the server's time zone,
  given by the API), never the browser's: a resident abroad still reads the city's hours, and says so.
*/

export const BOOKING_DAYS = 14

export { cityDay, dayCell, nextDays, type DayCell } from '../../lib/cityTime'
import type { DayCell } from '../../lib/cityTime'

export function groupByDay(slots: readonly AppointmentSlot[]): Map<string, AppointmentSlot[]> {
  const days = new Map<string, AppointmentSlot[]>()
  for (const slot of [...slots].sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))) {
    days.set(slot.day, [...(days.get(slot.day) ?? []), slot])
  }
  return days
}

/** The slots that can really be booked (not during an interruption of the service) */
export const openSlots = (slots: readonly AppointmentSlot[] | undefined) => (slots ?? []).filter((slot) => !slot.blocked)

/** Why a day cannot be chosen, said in words (never by a greyed-out square alone) */
export function closedReason(day: DayCell, slots: readonly AppointmentSlot[] | undefined): string | null {
  if (openSlots(slots).length) return null
  if (slots?.length) return 'Service interrompu'
  if (day.dow === 0) return 'Fermé le dimanche'
  if (day.dow === 6) return 'Fermé le samedi'
  return 'Complet'
}

export type DayPart = 'Matin' | 'Après-midi' | 'Soir'
export const dayPart = (startTime: string): DayPart => {
  const hour = Number(startTime.slice(0, 2))
  return hour < 12 ? 'Matin' : hour < 18 ? 'Après-midi' : 'Soir'
}

/* ─── F40: the reminder ─────────────────────────────────────────────────── */

export interface ReminderOption {
  /** minutes before the start; null: no reminder */
  value: number | null
  label: string
  detail: string
}

export const REMINDER_OPTIONS: ReminderOption[] = [
  { value: 1440, label: 'La veille', detail: '24 h avant' },
  { value: 120, label: '2 h avant', detail: 'le jour même' },
  { value: 60, label: '1 h avant', detail: 'juste avant de partir' },
  { value: null, label: 'Pas de rappel', detail: 'je m’en souviendrai' },
]

export const reminderLabel = (offset: number | null) => REMINDER_OPTIONS.find((o) => o.value === offset)?.label ?? (offset === null ? 'Pas de rappel' : `${Math.round(offset / 60)} h avant`)

/** "lundi 6 octobre à 09:30", in the city's time zone */
export function formatCityMoment(moment: number | string, timeZone: string): string {
  const at = new Date(moment)
  const day = new Intl.DateTimeFormat('fr-FR', { timeZone, weekday: 'long', day: 'numeric', month: 'long' }).format(at)
  const time = new Intl.DateTimeFormat('fr-FR', { timeZone, hour: '2-digit', minute: '2-digit' }).format(at)
  return `${day} à ${time}`
}

export interface ReminderPlan {
  /** when the reminder goes, in words; null: no reminder */
  when: string | null
  /** the moment is already past: the confirmation itself serves as reminder */
  immediate: boolean
}

export function reminderPlan(startsAt: string, offset: number | null, timeZone: string, now: number): ReminderPlan {
  if (offset === null) return { when: null, immediate: false }
  const at = Date.parse(startsAt) - offset * 60_000
  return { when: formatCityMoment(at, timeZone), immediate: at <= now }
}

/* ─── reading an appointment ────────────────────────────────────────────── */

const RELATIVE = new Intl.RelativeTimeFormat('fr-FR', { numeric: 'auto' })

/** "dans 2 jours", "demain", "dans 3 heures", "dans 20 minutes" */
export function countdown(startsAt: string, now: number): string {
  const minutes = Math.round((Date.parse(startsAt) - now) / 60_000)
  if (Math.abs(minutes) < 60) return RELATIVE.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return RELATIVE.format(hours, 'hour')
  return RELATIVE.format(Math.round(hours / 24), 'day')
}

export const STATUS: Record<AppointmentStatus, { label: string; tone: 'ok' | 'progress' | 'taken' | 'alert' | 'neutral' }> = {
  BOOKED: { label: 'Confirmé', tone: 'ok' },
  COMPLETED: { label: 'Honoré', tone: 'taken' },
  NO_SHOW: { label: 'Absence', tone: 'alert' },
  CANCELLED: { label: 'Annulé', tone: 'neutral' },
}

/** Documents of the linked procedure, whatever their stored shape */
export const documentsOf = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(String).filter(Boolean) : typeof value === 'string' ? value.split('\n').map((l) => l.trim()).filter(Boolean) : []

/** "Heure de Terra Nova" when the browser is elsewhere, so the hour is never read in the wrong zone */
export const zoneNote = (timeZone: string) => {
  const local = Intl.DateTimeFormat().resolvedOptions().timeZone
  return local === timeZone ? 'heure de Terra Nova' : `heure de Terra Nova (${timeZone})`
}
