import type { Availability } from '../../api/types'
import { currentLocale, defineMessages, localeTag, messagesFor, type Locale } from '../../i18n'
import type { Tone } from '../../ui/Badges'

const messages = defineMessages(
  {
    at: 'à',
    until: (moment: string) => `jusqu'au ${moment}`,
    untilFurtherNotice: "jusqu'à nouvel ordre",
    unavailable: 'Indisponible',
    degraded: 'Perturbé',
    open: 'Ouvert',
    plannedInterruption: (moment: string) => `Interruption prévue ${moment}`,
    immediate: 'Immédiat',
    delay: (days: number) => (days === 1 ? '≈ 1 jour' : `≈ ${days} jours`),
  },
  {
    at: 'at',
    until: (moment) => `until ${moment}`,
    untilFurtherNotice: 'until further notice',
    unavailable: 'Unavailable',
    degraded: 'Disrupted',
    open: 'Open',
    plannedInterruption: (moment) => `Interruption planned ${moment}`,
    immediate: 'Immediate',
    delay: (days) => (days === 1 ? '≈ 1 day' : `≈ ${days} days`),
  },
)

const formats = new Map<string, Intl.DateTimeFormat>()
const format = (locale: Locale, key: string, options: Intl.DateTimeFormatOptions) => {
  const id = `${locale}:${key}`
  let found = formats.get(id)
  if (!found) {
    found = new Intl.DateTimeFormat(localeTag(locale), options)
    formats.set(id, found)
  }
  return found
}

const MOMENT: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }
const SHORT_DAY: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }
const TIME: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }

/** "lundi 5 octobre à 07:00" (the process time zone, like the backend's labels) */
export const formatMoment = (iso: string, locale: Locale = currentLocale()): string => format(locale, 'moment', MOMENT).format(new Date(iso))

/** "lun. 5 oct. à 07:00", for the tiles */
export const formatShortMoment = (iso: string, locale: Locale = currentLocale()): string => {
  const date = new Date(iso)
  return `${format(locale, 'day', SHORT_DAY).format(date)} ${messagesFor(messages, locale).at} ${format(locale, 'time', TIME).format(date)}`
}

export interface AvailabilityView {
  status: Availability['status']
  tone: Tone
  /** always shown as text: the state is never told by the colour alone (F38) */
  label: string
  /** when it comes back, or why it is worth knowing */
  detail: string | null
}

/** F38: how a service's availability reads for a resident. */
export function availabilityView(availability: Availability, locale: Locale = currentLocale()): AvailabilityView {
  const m = messagesFor(messages, locale)
  const back = availability.back_at ? m.until(formatShortMoment(availability.back_at, locale)) : m.untilFurtherNotice
  switch (availability.status) {
    case 'UNAVAILABLE':
      return { status: 'UNAVAILABLE', tone: 'alert', label: m.unavailable, detail: back }
    case 'DEGRADED':
      return { status: 'DEGRADED', tone: 'progress', label: m.degraded, detail: back }
    default: {
      const next = availability.upcoming[0]
      return { status: 'AVAILABLE', tone: 'ok', label: m.open, detail: next ? m.plannedInterruption(formatShortMoment(next.starts_at, locale)) : null }
    }
  }
}

/** "≈ 3 jours", "Immédiat" */
export function formatDelay(days: number | null, locale: Locale = currentLocale()): string | null {
  if (days === null) return null
  const m = messagesFor(messages, locale)
  if (days <= 0) return m.immediate
  return m.delay(days)
}

/** `${count} ${word}`: French uses the singular for 0 and 1, English only for 1. */
export const plural = (count: number, one: string, many: string, locale: Locale = currentLocale()) =>
  `${count} ${(locale === 'en' ? count === 1 : count <= 1) ? one : many}`
