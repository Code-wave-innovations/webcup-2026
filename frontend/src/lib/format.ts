/** 2140 → "2 140" (French thousands separator). */
export function formatThousands(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

const publishedFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

/** Publication date shown to residents, e.g. "2 octobre 2026". */
export function formatPublished(iso: string): string {
  return publishedFormat.format(new Date(iso))
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
