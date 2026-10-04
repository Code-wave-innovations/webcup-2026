import { create } from 'zustand'
import { useDirectorStore } from '../../experience/director/directorStore'
import { frameState } from '../../experience/director/frameState'
import { formatLocalTime } from '../../lib/format'
import { announce } from '../../ui/toastStore'
import type { ReportSuggestion } from './analyzeReport'
import { RESOLVED, STATUSES, type Category, type Report, type ReportStatus, type Sector, type Urgency } from './reportModel'

export interface ReportDraft {
  text: string
  category: Category
  sector: Sector
  urgency: Urgency
  /** the fields were filled in by NOVA's reading */
  suggested: boolean
}

/** D16: what the server sent back after the report was recorded. */
export interface ReportConfirmation {
  message: string
  reference: string
  title: string
  category: Category
  sector: Sector
  urgency: Urgency
}

const EMPTY_DRAFT: ReportDraft = { text: '', category: 'Vie quotidienne', sector: 'Dôme 3', urgency: 'Moyenne', suggested: false }

interface ReportState {
  draft: ReportDraft
  confirmation: ReportConfirmation | null
  report: Report | null
  /** a report that came from POST /api/requests: no demonstration advance */
  fromApi: boolean
  editDraft: (patch: Partial<ReportDraft>) => void
  applySuggestion: (suggestion: ReportSuggestion) => void
  accept: (confirmation: ReportConfirmation) => void
  follow: () => void
  advance: () => void
  reset: () => void
}

const now = () => formatLocalTime(frameState.dusk)
const showSignal = (status: ReportStatus | -1) => useDirectorStore.getState().setSignalStatus(status)

/** The visitor's report: the draft being written, then the confirmation, then the tracked request. */
export const useReportStore = create<ReportState>()((set, get) => ({
  draft: EMPTY_DRAFT,
  confirmation: null,
  report: null,
  fromApi: false,
  editDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
  applySuggestion: (suggestion) => set((s) => ({ draft: { ...s.draft, ...suggestion, suggested: true } })),
  accept: (confirmation) => {
    set({ confirmation, report: null, fromApi: true, draft: EMPTY_DRAFT })
    showSignal(0)
    announce(`Demande ${confirmation.reference} envoyée`)
  },
  follow: () => {
    const { confirmation } = get()
    if (!confirmation) return
    set({
      report: {
        code: confirmation.reference,
        title: confirmation.title,
        category: confirmation.category,
        sector: confirmation.sector,
        urgency: confirmation.urgency,
        status: 0,
        times: [now()],
      },
      confirmation: null,
      fromApi: true,
    })
  },
  advance: () => {
    const { report, fromApi } = get()
    if (!report || fromApi || report.status >= RESOLVED) return
    const status = (report.status + 1) as ReportStatus
    const times = [...report.times]
    times[status] = now()
    set({ report: { ...report, status, times } })
    showSignal(status)
    announce(`${report.code} : ${STATUSES[status].name.toLowerCase()}`)
  },
  reset: () => {
    set({ report: null, confirmation: null, fromApi: false, draft: EMPTY_DRAFT })
    showSignal(-1)
  },
}))
