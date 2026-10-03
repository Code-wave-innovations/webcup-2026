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
