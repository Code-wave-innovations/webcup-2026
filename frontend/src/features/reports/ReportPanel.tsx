import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchOwnRequest, requestKeys } from '../../api/requests'
import { useSessionStore } from '../../api/session'
import { useAuthStore } from '../auth/authStore'
import { ReportForm } from './ReportForm'
import { ReportTracker } from './ReportTracker'
import { useReportStore } from './reportStore'

/** Report a problem, then follow it with the status the services actually set. */
export function ReportPanel() {
  const report = useReportStore((s) => s.report)
  const syncStatus = useReportStore((s) => s.syncStatus)
  const filmToken = useAuthStore((s) => s.session?.token)
  const apiToken = useSessionStore((s) => s.token)
  const token = filmToken ?? apiToken
  const live = useQuery({
    queryKey: [...requestKeys.detail(report?.id ?? 0), 'film'],
    queryFn: () => fetchOwnRequest(report!.id, token ?? ''),
    enabled: !!report && !!token,
    refetchInterval: 30_000,
    retry: false,
  })

  useEffect(() => {
    if (live.data) syncStatus(live.data.status)
  }, [live.data, syncStatus])

  return report ? <ReportTracker report={report} /> : <ReportForm />
}
