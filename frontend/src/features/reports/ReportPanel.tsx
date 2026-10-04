import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { isNetworkFailure } from '../../api/essentialCache'
import { fetchOwnRequest, requestKeys } from '../../api/requests'
import { useCitizenSessionStore } from '../../api/session'
import { useAuthStore } from '../auth/authStore'
import { useMaintenanceMode } from '../maintenance/maintenanceMode'
import { PlatformIncident } from '../maintenance/PlatformIncident'
import { ReportForm } from './ReportForm'
import { ReportTracker } from './ReportTracker'
import { useReportStore } from './reportStore'

/** Report a problem, then follow it with the status the services actually set. */
export function ReportPanel() {
  const report = useReportStore((s) => s.report)
  const syncStatus = useReportStore((s) => s.syncStatus)
  const citizenToken = useCitizenSessionStore((s) => s.token)
  // Film JWT only if the citizen slot is empty (mirrored airlock login / legacy).
  const readOnly = useMaintenanceMode()
  const filmToken = useAuthStore((s) => s.session?.token)
  const token = citizenToken ?? filmToken
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

  if (report) return <ReportTracker report={report} stale={live.isError && isNetworkFailure(live.error)} />
  if (readOnly) return <PlatformIncident nested />
  return <ReportForm />
}
