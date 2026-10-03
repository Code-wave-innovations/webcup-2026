const timeFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })
const dayFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
const fullFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full' })
const dateTimeFormat = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const compact = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 })
const plain = new Intl.NumberFormat('fr-FR')

export const formatTime = (iso: string) => timeFormat.format(new Date(iso))
export const formatDay = (iso: string) => dayFormat.format(new Date(iso))
export const formatFullDay = (iso: string) => fullFormat.format(new Date(iso))
export const formatDateTime = (iso: string) => dateTimeFormat.format(new Date(iso))
export const formatNumber = (value: number) => plain.format(value)
export const formatCompact = (value: number) => (Math.abs(value) >= 10_000 ? compact.format(value) : plain.format(value))

/** Unambiguous slot label (F39): "lundi 5 octobre 2026, 09:00 – 09:30". */
export const formatSlot = (startIso: string, endIso: string) =>
  `${formatFullDay(startIso)}, ${formatTime(startIso)} – ${formatTime(endIso)}`

/** "à l’instant", "il y a 12 min", "il y a 3 h", "il y a 2 j", or "dans 4 h" for future dates. */
export function formatRelative(iso: string, now: number): string {
  const diff = now - new Date(iso).getTime()
  const future = diff < 0
  const minutes = Math.round(Math.abs(diff) / 60_000)
  let text: string
  if (minutes < 1) return 'à l’instant'
  if (minutes < 60) text = `${minutes} min`
  else if (minutes < 60 * 24) text = `${Math.round(minutes / 60)} h`
  else text = `${Math.round(minutes / 1440)} j`
  return future ? `dans ${text}` : `il y a ${text}`
}

/** Age bucket used to colour how long a request has been waiting. */
export function ageTone(iso: string, now: number): 'ok' | 'progress' | 'alert' {
  const hours = (now - new Date(iso).getTime()) / 3_600_000
  if (hours < 4) return 'ok'
  if (hours < 24) return 'progress'
  return 'alert'
}

export const initials = (name: string, lastName = '') =>
  `${name.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || '?'
