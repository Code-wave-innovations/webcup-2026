/** 2140 → "2 140" (French thousands separator). */
export function formatThousands(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

const DUSK_START_MINUTES = 18 * 60 + 42
const DUSK_SPAN_MINUTES = 150

/** Local time shown in the city: 18:42 at the start of the flyover, 21:12 when night has fallen (`dusk` 0 → 1). */
export function formatLocalTime(dusk: number): string {
  const minutes = DUSK_START_MINUTES + Math.round(dusk * DUSK_SPAN_MINUTES)
  const hours = Math.floor(minutes / 60) % 24
  return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

const dateTimeFormat = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

export const formatDateTime = (iso: string) => dateTimeFormat.format(new Date(iso))

/** "à l’instant", "il y a 12 min", "il y a 3 h", "il y a 2 j". */
export function formatRelative(iso: string, now: number): string {
  const diff = now - new Date(iso).getTime()
  const future = diff < 0
  const minutesExact = Math.abs(diff) / 60_000
  if (minutesExact < 1) return 'à l’instant'
  const minutes = Math.round(minutesExact)
  let text: string
  if (minutes < 60) text = `${minutes} min`
  else if (minutes < 60 * 24) text = `${Math.round(minutes / 60)} h`
  else text = `${Math.round(minutes / 1440)} j`
  return future ? `dans ${text}` : `il y a ${text}`
}
