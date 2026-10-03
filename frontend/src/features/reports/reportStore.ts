import { create } from 'zustand'
import { useDirectorStore } from '../../experience/director/directorStore'
import { frameState } from '../../experience/director/frameState'
import { capitalize, formatLocalTime } from '../../lib/format'
import { announce } from '../../ui/toastStore'
import type { ReportSuggestion } from './analyzeReport'
import { RESOLVED, STATUSES, TITLE_LENGTH, type Category, type Report, type ReportStatus, type Sector, type Urgency } from './reportModel'

export interface ReportDraft {
  text: string
  category: Category
  sector: Sector
  urgency: Urgency
  /** the fields were filled in by NOVA's reading */
  suggested: boolean
}

const EMPTY_DRAFT: ReportDraft = { text: '', category: 'Vie quotidienne', sector: 'Dôme 3', urgency: 'Moyenne', suggested: false }
/** Demo reference: the example report of the API documentation. */
const REPORT_CODE = 'TN-0416'

interface ReportState {
  draft: ReportDraft
  report: Report | null
  editDraft: (patch: Partial<ReportDraft>) => void
  applySuggestion: (suggestion: ReportSuggestion) => void
  submit: () => void
  advance: () => void
  reset: () => void
}

const now = () => formatLocalTime(frameState.dusk)
const showSignal = (status: ReportStatus | -1) => useDirectorStore.getState().setSignalStatus(status)

/** The visitor's report: the draft being written, then the tracked request lighting the beam over dome 3. */
export const useReportStore = create<ReportState>()((set, get) => ({
  draft: EMPTY_DRAFT,
  report: null,
  editDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
  applySuggestion: (suggestion) => set((s) => ({ draft: { ...s.draft, ...suggestion, suggested: true } })),
  submit: () => {
    const { draft } = get()
    const text = draft.text.trim()
    const report: Report = {
      code: REPORT_CODE,
      title: capitalize(text.slice(0, TITLE_LENGTH)),
      category: draft.category,
      sector: draft.sector,
      urgency: draft.urgency,
      status: 0,
      times: [now()],
    }
    set({ report, draft: EMPTY_DRAFT })
    showSignal(0)
    announce(`Demande ${REPORT_CODE} envoyée au Haut Conseil`)
  },
  advance: () => {
    const { report } = get()
    if (!report || report.status >= RESOLVED) return
    const status = (report.status + 1) as ReportStatus
    const times = [...report.times]
    times[status] = now()
    set({ report: { ...report, status, times } })
    showSignal(status)
    announce(`${report.code} : ${STATUSES[status].name.toLowerCase()}`)
  },
  reset: () => {
    set({ report: null, draft: EMPTY_DRAFT })
    showSignal(-1)
  },
}))
