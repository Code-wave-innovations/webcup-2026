// F50: when an indicator of the simplified dashboard needs attention. A state is always
// shown with an icon and a word, never by its colour alone (F43).

export type IndicatorState = 'normal' | 'watch' | 'critical'

export const THRESHOLDS = {
  /** requests waiting for a first pickup */
  awaitingPickup: { watch: 5, critical: 10 },
  /** overdue requests (delay by priority, set by the server): more than 3 → to watch */
  overdue: { watch: 4, critical: 8 },
  /** median hours before a first pickup */
  medianPickupHours: { watch: 24, critical: 48 },
  /** share of no-shows among the appointments */
  noShowRate: { watch: 0.1, critical: 0.25 },
} as const

/** `value` reaching `watch` → « À surveiller », reaching `critical` → « Critique ». */
export function stateOf(value: number | null, limits: { watch: number; critical: number }): IndicatorState {
  if (value === null) return 'normal'
  if (value >= limits.critical) return 'critical'
  if (value >= limits.watch) return 'watch'
  return 'normal'
}

/** D17: same delays as OVERDUE_HOURS on the server (backend/src/model/dashboard.model.ts). */
export const OVERDUE_HOURS = { URGENT: 4, HIGH: 24, NORMAL: 72, LOW: 120 } as const

const WAITING_ON_CITY = ['SUBMITTED', 'IN_REVIEW', 'IN_PROGRESS']

/** The city still has to act on it, past the delay of its priority. */
export function isOverdue(request: { status: string; priority: keyof typeof OVERDUE_HOURS; created_at: string }, now: number): boolean {
  if (!WAITING_ON_CITY.includes(request.status)) return false
  return now - new Date(request.created_at).getTime() > OVERDUE_HOURS[request.priority] * 3_600_000
}
