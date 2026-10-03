// Demo data is laid out around the moment the page loads, so "il y a 12 min" stays believable.
export const LOADED_AT = Date.now()

const MINUTE = 60_000

export const minutesAgo = (minutes: number) => new Date(LOADED_AT - minutes * MINUTE).toISOString()
export const hoursAgo = (hours: number) => minutesAgo(hours * 60)
export const daysAgo = (days: number) => minutesAgo(days * 24 * 60)
export const inMinutes = (minutes: number) => minutesAgo(-minutes)
export const inHours = (hours: number) => minutesAgo(-hours * 60)

/** Today (or in `dayOffset` days) at hh:mm, local time. */
export const atTime = (hours: number, minutes = 0, dayOffset = 0) => {
  const date = new Date(LOADED_AT)
  date.setDate(date.getDate() + dayOffset)
  date.setHours(hours, minutes, 0, 0)
  return date.toISOString()
}
