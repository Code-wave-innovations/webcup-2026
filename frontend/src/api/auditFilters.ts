/** Query sent to GET /api/audit-logs. `entity` is one or several model names. */
export interface AuditFilters {
  actor_id?: number
  entity?: string[]
  entity_id?: number
  action?: string
  from?: string
  to?: string
  q?: string
  page?: number
  limit?: number
  summary?: boolean
  facets?: boolean
  /** Resolved to `from` when the request runs, so the query key stays stable. */
  period?: 'hour' | 'day' | 'week' | 'all'
}

export const toParams = (filters: AuditFilters) => ({
  actor_id: filters.actor_id,
  entity: filters.entity?.length ? filters.entity.join(',') : undefined,
  entity_id: filters.entity_id,
  action: filters.action || undefined,
  from: filters.from ?? (filters.period && filters.period !== 'all' ? periodStart(filters.period) : undefined),
  to: filters.to,
  q: filters.q || undefined,
  page: filters.page,
  limit: filters.limit,
  summary: filters.summary ? 1 : undefined,
  facets: filters.facets ? 1 : undefined,
})

const PERIOD_MS = { hour: 3_600_000, day: 86_400_000, week: 7 * 86_400_000 } as const
export type AuditPeriod = keyof typeof PERIOD_MS | 'all'

/** Start of the window, computed when the request runs (not during render). */
export const periodStart = (period: AuditPeriod) =>
  period === 'all' ? undefined : new Date(Date.now() - PERIOD_MS[period]).toISOString()
