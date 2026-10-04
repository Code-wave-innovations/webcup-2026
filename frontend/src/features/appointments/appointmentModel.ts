import type { AppointmentSlot, AppointmentStatus } from '../../api/types'
import { currentLocale, defineMessages, localeTag, messagesFor, type Locale } from '../../i18n'

/*
  F39 / F40: no doubt about the chosen slot. Every day and time is the city's (the server's time zone,
  given by the API), never the browser's: a resident abroad still reads the city's hours, and says so.
*/

export const BOOKING_DAYS = 14

const messages = defineMessages(
  {
    interrupted: 'Service interrompu',
    closedSunday: 'Fermé le dimanche',
    closedSaturday: 'Fermé le samedi',
    full: 'Complet',
    parts: { Matin: 'Matin', 'Après-midi': 'Après-midi', Soir: 'Soir' },
    reminders: {
      dayBefore: 'La veille',
      dayBeforeDetail: '24 h avant',
      twoHours: '2 h avant',
      twoHoursDetail: 'le jour même',
      oneHour: '1 h avant',
      oneHourDetail: 'juste avant de partir',
      none: 'Pas de rappel',
      noneDetail: 'je m’en souviendrai',
      hoursBefore: (hours: number) => `${hours} h avant`,
    },
    at: 'à',
    status: { BOOKED: 'Confirmé', COMPLETED: 'Honoré', NO_SHOW: 'Absence', CANCELLED: 'Annulé' },
    cityTime: 'heure de Terra Nova',
    cityTimeZone: (zone: string) => `heure de Terra Nova (${zone})`,
  },
  {
    interrupted: 'Service interrupted',
    closedSunday: 'Closed on Sundays',
    closedSaturday: 'Closed on Saturdays',
    full: 'Fully booked',
    parts: { Matin: 'Morning', 'Après-midi': 'Afternoon', Soir: 'Evening' },
    reminders: {
      dayBefore: 'The day before',
      dayBeforeDetail: '24 h before',
      twoHours: '2 h before',
      twoHoursDetail: 'on the day',
      oneHour: '1 h before',
      oneHourDetail: 'just before leaving',
      none: 'No reminder',
      noneDetail: 'I’ll remember',
      hoursBefore: (hours) => `${hours} h before`,
    },
    at: 'at',
    status: { BOOKED: 'Confirmed', COMPLETED: 'Attended', NO_SHOW: 'Missed', CANCELLED: 'Cancelled' },
    cityTime: 'Terra Nova time',
    cityTimeZone: (zone) => `Terra Nova time (${zone})`,
  },
)

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
export function closedReason(day: DayCell, slots: readonly AppointmentSlot[] | undefined, locale: Locale = currentLocale()): string | null {
  if (openSlots(slots).length) return null
  const m = messagesFor(messages, locale)
  if (slots?.length) return m.interrupted
  if (day.dow === 0) return m.closedSunday
  if (day.dow === 6) return m.closedSaturday
  return m.full
}

/** A part of the day; the value is an identifier, `dayPartLabel` names it in the visitor's language */
export type DayPart = 'Matin' | 'Après-midi' | 'Soir'
export const dayPart = (startTime: string): DayPart => {
  const hour = Number(startTime.slice(0, 2))
  return hour < 12 ? 'Matin' : hour < 18 ? 'Après-midi' : 'Soir'
}
export const dayPartLabel = (part: DayPart, locale: Locale = currentLocale()) => messagesFor(messages, locale).parts[part]

/* ─── F40: the reminder ─────────────────────────────────────────────────── */

export interface ReminderOption {
  /** minutes before the start; null: no reminder */
  value: number | null
  label: string
  detail: string
}

export function reminderOptions(locale: Locale = currentLocale()): ReminderOption[] {
  const r = messagesFor(messages, locale).reminders
  return [
    { value: 1440, label: r.dayBefore, detail: r.dayBeforeDetail },
    { value: 120, label: r.twoHours, detail: r.twoHoursDetail },
    { value: 60, label: r.oneHour, detail: r.oneHourDetail },
    { value: null, label: r.none, detail: r.noneDetail },
  ]
}

export const reminderLabel = (offset: number | null, locale: Locale = currentLocale()) => {
  const r = messagesFor(messages, locale).reminders
  return reminderOptions(locale).find((o) => o.value === offset)?.label ?? (offset === null ? r.none : r.hoursBefore(Math.round(offset / 60)))
}

/** "lundi 6 octobre à 09:30", in the city's time zone */
export function formatCityMoment(moment: number | string, timeZone: string, locale: Locale = currentLocale()): string {
  const at = new Date(moment)
  const tag = localeTag(locale)
  const day = new Intl.DateTimeFormat(tag, { timeZone, weekday: 'long', day: 'numeric', month: 'long' }).format(at)
  const time = new Intl.DateTimeFormat(tag, { timeZone, hour: '2-digit', minute: '2-digit' }).format(at)
  return `${day} ${messagesFor(messages, locale).at} ${time}`
}

export interface ReminderPlan {
  /** when the reminder goes, in words; null: no reminder */
  when: string | null
  /** the moment is already past: the confirmation itself serves as reminder */
  immediate: boolean
}

export function reminderPlan(startsAt: string, offset: number | null, timeZone: string, now: number, locale: Locale = currentLocale()): ReminderPlan {
  if (offset === null) return { when: null, immediate: false }
  const at = Date.parse(startsAt) - offset * 60_000
  return { when: formatCityMoment(at, timeZone, locale), immediate: at <= now }
}

/* ─── reading an appointment ────────────────────────────────────────────── */

const relative: Partial<Record<Locale, Intl.RelativeTimeFormat>> = {}

/** "dans 2 jours", "demain", "dans 3 heures", "dans 20 minutes" */
export function countdown(startsAt: string, now: number, locale: Locale = currentLocale()): string {
  const format = (relative[locale] ??= new Intl.RelativeTimeFormat(localeTag(locale), { numeric: 'auto' }))
  const minutes = Math.round((Date.parse(startsAt) - now) / 60_000)
  if (Math.abs(minutes) < 60) return format.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return format.format(hours, 'hour')
  return format.format(Math.round(hours / 24), 'day')
}

export type StatusTone = 'ok' | 'progress' | 'taken' | 'alert' | 'neutral'

const STATUS_TONE: Record<AppointmentStatus, StatusTone> = { BOOKED: 'ok', COMPLETED: 'taken', NO_SHOW: 'alert', CANCELLED: 'neutral' }

/** An appointment's status, named in the visitor's language */
export const statusView = (status: AppointmentStatus, locale: Locale = currentLocale()): { label: string; tone: StatusTone } => ({
  label: messagesFor(messages, locale).status[status],
  tone: STATUS_TONE[status],
})

/** Documents of the linked procedure, whatever their stored shape */
export const documentsOf = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(String).filter(Boolean) : typeof value === 'string' ? value.split('\n').map((l) => l.trim()).filter(Boolean) : []

/** "Heure de Terra Nova" when the browser is elsewhere, so the hour is never read in the wrong zone */
export const zoneNote = (timeZone: string, locale: Locale = currentLocale()) => {
  const local = Intl.DateTimeFormat().resolvedOptions().timeZone
  const m = messagesFor(messages, locale)
  return local === timeZone ? m.cityTime : m.cityTimeZone(timeZone)
}
