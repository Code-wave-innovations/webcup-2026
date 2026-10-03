import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { http } from './client'
import { queryClient, REFRESH } from './queryClient'
import type { AuditList, AuditStats } from './types'
import { toParams, type AuditFilters } from './auditFilters'

export type { AuditFilters } from './auditFilters'

// F47 / F48: the immutable journal. Screens never write to it.

export const auditKeys = {
  all: ['audit-logs'] as const,
  list: (filters: AuditFilters) => [...auditKeys.all, 'list', filters] as const,
  stats: (days: number) => [...auditKeys.all, 'stats', days] as const,
}

export const useAuditLogs = (filters: AuditFilters = {}, options?: { live?: boolean }) =>
  useQuery({
    queryKey: auditKeys.list(filters),
    queryFn: () => http.get<AuditList>('/audit-logs', { params: toParams(filters) }).then((r) => r.data),
    placeholderData: keepPreviousData,
    refetchInterval: options?.live ? REFRESH.audit : false,
  })

export const useAuditStats = (days = 14) =>
  useQuery({
    queryKey: auditKeys.stats(days),
    queryFn: () => http.get<AuditStats>('/audit-logs/stats', { params: { days } }).then((r) => r.data),
    refetchInterval: REFRESH.audit,
  })

/** Downloads the filtered journal. The server records the export. */
export async function downloadAuditCsv(filters: AuditFilters): Promise<{ rowsLabel: string; truncated: boolean }> {
  const response = await http.get<Blob>('/audit-logs/export.csv', {
    params: toParams(filters),
    responseType: 'blob',
    // Read the status ourselves: an error body is a blob, which the JSON interceptor cannot parse.
    validateStatus: () => true,
  })
  if (response.status >= 400) {
    let message = 'L’export n’a pas abouti.'
    try {
      const body = JSON.parse(await (response.data as Blob).text()) as { error?: { message?: string } }
      if (body.error?.message) message = body.error.message
    } catch {
      /* keep the fallback sentence */
    }
    throw new Error(message)
  }
  const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'journal-audit.csv'
  link.click()
  URL.revokeObjectURL(url)
  void queryClient.invalidateQueries({ queryKey: auditKeys.all })
  return { rowsLabel: 'journal-audit.csv', truncated: response.headers['x-export-truncated'] === '1' }
}
