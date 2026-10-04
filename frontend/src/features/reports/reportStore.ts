import { create } from 'zustand'
import type { RequestStatus } from '../../api/types'
import type { UrgencyHint } from '../../api/requests'
import { useDirectorStore } from '../../experience/director/directorStore'
import { anchorForDistrict } from './districtAnchor'
import type { ReportSuggestion } from './analyzeReport'
import { signalForStatus, type Category } from './reportModel'

export interface ReportDraft {
  text: string
  location: string
  category: Category
  districtId: number | null
  urgency: UrgencyHint
  /** the fields were filled in by NOVA's reading */
  suggested: boolean
}

/** A report the API accepted, followed on the flyover until the visitor sends another. */
export interface TrackedReport {
  id: number
  code: string
  title: string
  category: string
  districtName: string
  districtCode: string | null
  location: string
  urgency: UrgencyHint
  status: RequestStatus
  confirmation: string
  receivedAt: string
}

const EMPTY_DRAFT: ReportDraft = {
  text: '',
  location: '',
  category: 'Autre',
  districtId: null,
  urgency: 'NORMAL',
  suggested: false,
}

interface ReportState {
  draft: ReportDraft
  report: TrackedReport | null
  editDraft: (patch: Partial<ReportDraft>) => void
  applySuggestion: (suggestion: ReportSuggestion) => void
  accept: (report: TrackedReport) => void
  syncStatus: (status: RequestStatus) => void
  reset: () => void
}

const showSignal = (status: RequestStatus, districtCode: string | null) => {
  const director = useDirectorStore.getState()
  const { beam } = signalForStatus(status)
  director.setSignalStatus(beam)
  if (beam >= 0) director.setSignalAnchor(anchorForDistrict(districtCode))
}

/** The visitor's report: the draft being written, then the tracked request lighting the beam over its district. */
export const useReportStore = create<ReportState>()((set, get) => ({
  draft: EMPTY_DRAFT,
  report: null,
  editDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
  applySuggestion: (suggestion) =>
    set((s) => ({
      draft: {
        ...s.draft,
        category: suggestion.category,
        districtId: suggestion.districtId ?? s.draft.districtId,
        urgency: suggestion.urgency,
        suggested: true,
      },
    })),
  accept: (report) => {
    set({ report, draft: EMPTY_DRAFT })
    showSignal(report.status, report.districtCode)
  },
  syncStatus: (status) => {
    const { report } = get()
    if (!report || report.status === status) return
    set({ report: { ...report, status } })
    showSignal(status, report.districtCode)
  },
  reset: () => {
    set({ report: null, draft: EMPTY_DRAFT })
    const director = useDirectorStore.getState()
    director.setSignalStatus(-1)
    director.setSignalAnchor('trois')
  },
}))
