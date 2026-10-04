import type { ActiveAlert, AlertSeverity } from '../../api/types'
import { currentLocale, defineMessages, localeTag, messagesFor, type Locale } from '../../i18n'
import type { IconName } from '../../ui/Icon'
import { recommendationsOf, stepsOf } from '../../lib/alertText'

export { recommendationsOf, stepsOf }

const messages = defineMessages(
  {
    severity: { CRITICAL: 'Alerte critique', WARNING: 'Vigilance', INFO: 'Information' },
    targetedDistricts: 'Quartiers ciblés',
    vulnerable: 'Personnes vulnérables',
    vulnerableIn: (names: string) => `Personnes vulnérables · ${names}`,
    wholeCity: 'Toute la ville',
    until: (moment: string) => `jusqu'à ${moment}`,
    untilFurtherNotice: "jusqu'à nouvel ordre",
    since: (moment: string, end: string) => `Depuis ${moment} · ${end}`,
  },
  {
    severity: { CRITICAL: 'Critical alert', WARNING: 'Warning', INFO: 'Information' },
    targetedDistricts: 'Targeted districts',
    vulnerable: 'Vulnerable people',
    vulnerableIn: (names) => `Vulnerable people · ${names}`,
    wholeCity: 'The whole city',
    until: (moment) => `until ${moment}`,
    untilFurtherNotice: 'until further notice',
    since: (moment, end) => `Since ${moment} · ${end}`,
  },
)

/** D18: the level is always written and drawn, never told by the colour alone. */
export const SEVERITY_RANK: Record<AlertSeverity, number> = { CRITICAL: 3, WARNING: 2, INFO: 1 }

/** The level's name in the visitor's language */
export const severityLabel = (severity: AlertSeverity, locale: Locale = currentLocale()): string => messagesFor(messages, locale).severity[severity]

export const SEVERITY_ICON: Record<AlertSeverity, IconName> = { CRITICAL: 'siren', WARNING: 'alert', INFO: 'info' }

/** What concerns me first, then the most serious, then the most recent. */
export function sortAlerts<T extends Pick<ActiveAlert, 'concerns_me' | 'severity' | 'starts_at'>>(alerts: readonly T[]): T[] {
  return [...alerts].sort(
    (a, b) =>
      Number(b.concerns_me) - Number(a.concerns_me) ||
      SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
      Date.parse(b.starts_at) - Date.parse(a.starts_at),
  )
}

/** F29 / F31: who the alert speaks to, in the visitor's language. */
export function zoneLabel(alert: Pick<ActiveAlert, 'audience' | 'districts'>, locale: Locale = currentLocale()): string {
  const m = messagesFor(messages, locale)
  const names = alert.districts.map((d) => d.name).join(', ')
  if (alert.audience === 'DISTRICTS') return names || m.targetedDistricts
  if (alert.audience === 'VULNERABLE') return names ? m.vulnerableIn(names) : m.vulnerable
  return m.wholeCity
}

/** setTimeout holds at most ~24.8 days */
const MAX_TIMER_MS = 2_147_000_000

/**
 * How long to wait before asking again, so an alert appears at its start and leaves at its end
 * instead of waiting for the next poll. Null when nothing changes ahead.
 */
export function alertWakeMs(now: number, moments: readonly number[]): number | null {
  const ahead = moments.filter((moment) => Number.isFinite(moment) && moment > now)
  if (ahead.length === 0) return null
  return Math.min(MAX_TIMER_MS, Math.max(0, Math.min(...ahead) - now) + 500)
}

/** The alerts that must take over the screen: they concern me and I have not acknowledged them. */
export function pendingTransmissions<T extends Pick<ActiveAlert, 'id' | 'concerns_me'>>(sorted: readonly T[], acknowledged: readonly number[]): T[] {
  return sorted.filter((a) => a.concerns_me && !acknowledged.includes(a.id))
}

const formats: Partial<Record<Locale, { time: Intl.DateTimeFormat; day: Intl.DateTimeFormat }>> = {}
const formatsOf = (locale: Locale) =>
  (formats[locale] ??= {
    time: new Intl.DateTimeFormat(localeTag(locale), { hour: '2-digit', minute: '2-digit' }),
    day: new Intl.DateTimeFormat(localeTag(locale), { weekday: 'long', day: 'numeric', month: 'long' }),
  })

/** "14:32", or "lundi 5 octobre, 14:32" when it is not today */
export function formatWhen(iso: string, now: number, locale: Locale = currentLocale()): string {
  const { time, day } = formatsOf(locale)
  const date = new Date(iso)
  const sameDay = new Date(now).toDateString() === date.toDateString()
  return sameDay ? time.format(date) : `${day.format(date)}, ${time.format(date)}`
}

/** "Depuis 14:32 · jusqu'à 20:00" */
export function periodOf(alert: Pick<ActiveAlert, 'starts_at' | 'ends_at'>, now: number, locale: Locale = currentLocale()): string {
  const m = messagesFor(messages, locale)
  const end = alert.ends_at ? m.until(formatWhen(alert.ends_at, now, locale)) : m.untilFurtherNotice
  return m.since(formatWhen(alert.starts_at, now, locale), end)
}

/* ─── what this browser remembers (per viewer, not shared) ──────────────── */

const STORAGE_KEY = 'nova-alerts'

export interface AlertMemory {
  /** read the transmission and pressed « J'ai compris » */
  acknowledged: number[]
  /** folded away from the banner */
  dismissed: number[]
}

export function readMemory(): AlertMemory {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<AlertMemory>
    return { acknowledged: raw.acknowledged ?? [], dismissed: raw.dismissed ?? [] }
  } catch {
    return { acknowledged: [], dismissed: [] }
  }
}

/** Keeps only the alerts still in force, so the list never grows. */
export function writeMemory(memory: AlertMemory, activeIds: readonly number[]): void {
  const keep = (ids: number[]) => ids.filter((id) => activeIds.includes(id))
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ acknowledged: keep(memory.acknowledged), dismissed: keep(memory.dismissed) }))
  } catch {
    // private window or blocked storage: the alerts simply show again on the next visit
  }
}
