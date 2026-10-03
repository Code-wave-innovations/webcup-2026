import { useAuthStore } from '../auth/authStore'
import { ReportForm } from './ReportForm'
import { ReportTracker } from './ReportTracker'
import { useReportStore } from './reportStore'

/** Report a problem, then follow it until it is resolved. */
export function ReportPanel() {
  const report = useReportStore((s) => s.report)
  const session = useAuthStore((s) => s.session)
  return report ? <ReportTracker report={report} session={session} /> : <ReportForm />
}
