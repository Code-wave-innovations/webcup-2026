// Periods of the journal filters, as the `from` date they start at
export type Period = 'heure' | 'jour' | 'semaine' | 'mois' | 'tout'

export const PERIODS: { value: Period; label: string; ms: number | null }[] = [
  { value: 'heure', label: '1 h', ms: 3_600_000 },
  { value: 'jour', label: '24 h', ms: 86_400_000 },
  { value: 'semaine', label: '7 j', ms: 7 * 86_400_000 },
  { value: 'mois', label: '30 j', ms: 30 * 86_400_000 },
  { value: 'tout', label: 'Tout', ms: null },
]

/** ISO start of a period, rounded to the minute so the query key stays stable */
export function periodFrom(period: Period, now: number): string | undefined {
  const ms = PERIODS.find((p) => p.value === period)?.ms
  if (!ms) return undefined
  return new Date(Math.floor((now - ms) / 60_000) * 60_000).toISOString()
}
