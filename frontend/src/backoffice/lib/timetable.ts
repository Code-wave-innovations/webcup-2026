// F36: preview of the regular service the server generates (backend/src/lib/transit.ts, buildRegularService):
// one run every `everyMinutes` from `first` to `last` at the first stop, each following stop
// `minutesBetweenStops` later, nothing after midnight; the return trip leaves the other end at the same times.

export interface ServiceOptions {
  first: string
  last: string
  everyMinutes: number
  minutesBetweenStops: number
  returnTrip: boolean
}

export interface DirectionPreview {
  /** name of the stop the runs end at */
  towards: string
  /** departures from the first stop of this direction */
  times: string[]
  /** departures at every stop of the run */
  departures: number
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

export const isHHMM = (value: string) => HHMM.test(value)

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
const toHHMM = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

/** The service per direction, or [] when the inputs cannot produce one. */
export function previewService(stopNames: string[], options: ServiceOptions): DirectionPreview[] {
  const { first, last, everyMinutes, minutesBetweenStops } = options
  if (stopNames.length === 0 || !isHHMM(first) || !isHHMM(last) || !(everyMinutes >= 1) || !(minutesBetweenStops >= 0)) return []
  const orders = options.returnTrip ? [stopNames, [...stopNames].reverse()] : [stopNames]
  return orders.map((order) => {
    const times: string[] = []
    let departures = 0
    for (let start = toMinutes(first); start <= toMinutes(last); start += everyMinutes) {
      times.push(toHHMM(start))
      departures += order.filter((_, index) => start + index * minutesBetweenStops < 24 * 60).length
    }
    return { towards: order[order.length - 1], times, departures }
  })
}

/** "06:00, 06:15, 06:30 … 21:45, 22:00" for long lists */
export function summarizeTimes(times: string[], head = 4, tail = 2): string {
  return times.length <= head + tail ? times.join(', ') : `${times.slice(0, head).join(', ')} … ${times.slice(-tail).join(', ')}`
}
