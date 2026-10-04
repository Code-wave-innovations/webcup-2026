import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { http } from './client'
import { REFRESH } from './queryClient'
import type { AuditEntry, AuditStats, Paginated } from './types'

// F47 / F48: the audit journal (GET /api/audit-logs), read-only by design

export interface AuditFilters {
  actor_id?: number
  entity?: string
  entity_id?: number
  /** exact action, or a family with a trailing dot ("request.") */
  action?: string
  /** ISO dates */
  from?: string
  to?: string
  q?: string
  page?: number
  limit?: number
}

export const auditKeys = {
  all: ['audit'] as const,
  list: (filters: AuditFilters) => [...auditKeys.all, 'list', filters] as const,
  stats: (days: number) => [...auditKeys.all, 'stats', days] as const,
}

export const useAuditLogs = (filters: AuditFilters, options: { enabled?: boolean; live?: boolean } = {}) =>
  useQuery({
    queryKey: auditKeys.list(filters),
    queryFn: () => http.get<Paginated<AuditEntry>>('/audit-logs', { params: filters }).then((r) => r.data),
    enabled: options.enabled ?? true,
    placeholderData: keepPreviousData,
    refetchInterval: options.live ? REFRESH.audit : false,
  })

export const useAuditStats = (days = 14, enabled = true) =>
  useQuery({
    queryKey: auditKeys.stats(days),
    queryFn: () => http.get<AuditStats>('/audit-logs/stats', { params: { days } }).then((r) => r.data),
    enabled,
    refetchInterval: REFRESH.dashboard,
  })

/** Admin: downloads the journal with the current filters as a CSV that a spreadsheet opens with its accents. */
export async function downloadAuditCsv(filters: Omit<AuditFilters, 'page' | 'limit'>) {
  const response = await http.get<Blob>('/audit-logs/export.csv', { params: filters, responseType: 'blob' })
  const disposition = String(response.headers['content-disposition'] ?? '')
  const name = disposition.match(/filename="([^"]+)"/)?.[1] ?? 'journal-audit.csv'
  const url = URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}
