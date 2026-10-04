// F39: the city's calendar days, read in the server's time zone (given by the API), never the browser's.
// Shared by the resident's booking and the agents' agenda.

/** "2026-10-07" of a moment, in the city's time zone */
export function cityDay(moment: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(moment))
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** A calendar date's noon in UTC: naming its weekday never depends on a time zone */
const noonOf = (key: string) => new Date(`${key}T12:00:00Z`)
const addDays = (key: string, days: number) => new Date(noonOf(key).getTime() + days * 86_400_000).toISOString().slice(0, 10)

export interface DayCell {
  key: string
  /** "mar." */
  weekday: string
  /** "7" */
  date: string
  /** "oct." */
  month: string
  /** "mardi 7 octobre 2026" */
  label: string
  /** 0 = Sunday … 6 = Saturday */
  dow: number
}

export function dayCell(key: string): DayCell {
  const at = noonOf(key)
  const f = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', ...options }).format(at)
  return { key, weekday: f({ weekday: 'short' }), date: f({ day: 'numeric' }), month: f({ month: 'short' }), label: f({ dateStyle: 'full' }), dow: at.getUTCDay() }
}

/** The city's next days, today first */
export function nextDays(now: number, timeZone: string, count = 14): DayCell[] {
  const today = cityDay(now, timeZone)
  return Array.from({ length: count }, (_, i) => dayCell(addDays(today, i)))
}

