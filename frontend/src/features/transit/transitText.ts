import type { Tone } from '../../ui/Badges'
import type { TransitDeparture, TransitLineDetail, TransitLineStatus, TransitLineSummary } from '../../api/types'
import { currentLocale, defineMessages, messagesFor, type Locale } from '../../i18n'

// F36: how transport data is worded for residents (pure, tested)

/** A line is always named by its code and name, never by its colour alone. */
export const lineLabel = (line: Pick<TransitLineSummary, 'code' | 'name'>) => `${line.code} · ${line.name}`

export const STATUS_TONE: Record<TransitLineStatus, Tone> = {
  NORMAL: 'ok',
  DISRUPTED: 'progress',
  INTERRUPTED: 'alert',
}

const waitMessages = defineMessages(
  {
    now: 'à l’instant',
    minutes: (n: number) => `dans ${n} min`,
    hours: (h: number, mm: string) => `dans ${h} h ${mm}`,
  },
  {
    now: 'now',
    minutes: (n) => `in ${n} min`,
    hours: (h, mm) => `in ${h} h ${mm}`,
  },
)

/** 0 → "à l'instant" / "now", 4 → "dans 4 min" / "in 4 min", 65 → "dans 1 h 05" */
export function waitLabel(minutes: number, locale: Locale = currentLocale()): string {
  const m = messagesFor(waitMessages, locale)
  if (minutes <= 0) return m.now
  if (minutes < 60) return m.minutes(minutes)
  return m.hours(Math.floor(minutes / 60), String(minutes % 60).padStart(2, '0'))
}

export interface DepartureGroup {
  key: string
  line: TransitLineSummary
  direction: string | null
  departures: TransitDeparture[]
}

/** Next departures at a stop, by line and direction, soonest group first, `perGroup` departures each. */
export function groupDepartures(departures: TransitDeparture[], perGroup = 3): DepartureGroup[] {
  const groups = new Map<string, DepartureGroup>()
  for (const departure of [...departures].sort((a, b) => a.minutes_until - b.minutes_until)) {
    const key = `${departure.line.id}:${departure.direction ?? ''}`
    const group = groups.get(key) ?? { key, line: departure.line, direction: departure.direction, departures: [] }
    if (group.departures.length < perGroup) group.departures.push(departure)
    groups.set(key, group)
  }
  return [...groups.values()]
}

/** Favourite stops kept in `User.preferences.favorite_stops` (ids), tolerant of anything stored there. */
export function favoriteStopsOf(preferences: Record<string, unknown> | null | undefined): number[] {
  const value = preferences?.favorite_stops
  return Array.isArray(value) ? value.filter((id): id is number => Number.isInteger(id) && id > 0) : []
}

type LineStop = TransitLineDetail['stops'][number]

export interface DirectionTimetable {
  direction: string
  rows: { stop: LineStop; times: string[] }[]
}

/**
 * One timetable per direction, stops in the order the vehicle reaches them (by first departure), without the
 * terminus where the run ends (arrivals, not departures). Directions keep the order the API lists them in.
 */
export function timetableByDirection(stops: LineStop[]): DirectionTimetable[] {
  const directions = [...new Set(stops.flatMap((stop) => Object.keys(stop.times_by_direction ?? {})))]
  return directions
    .map((direction) => ({
      direction,
      rows: stops
        .filter((stop) => stop.name !== direction && stop.times_by_direction?.[direction]?.length)
        .map((stop) => ({ stop, times: stop.times_by_direction[direction] }))
        .sort((a, b) => a.times[0].localeCompare(b.times[0])),
    }))
    .filter((timetable) => timetable.rows.length > 0)
}
