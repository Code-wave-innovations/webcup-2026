import { ReportForm } from './ReportForm'
import { ReportTracker } from './ReportTracker'
import { RequestConfirmation } from './RequestConfirmation'
import { useReportStore } from './reportStore'

/** Report a problem, then follow it until it is resolved. */
export function ReportPanel() {
  const report = useReportStore((s) => s.report)
  const confirmation = useReportStore((s) => s.confirmation)
  if (report) return <ReportTracker report={report} />
  if (confirmation) return <RequestConfirmation />
  return <ReportForm />
}
