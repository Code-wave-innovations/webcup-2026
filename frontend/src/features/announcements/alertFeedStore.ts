import { create } from 'zustand'
import type { ActiveAlert } from '../../api/types'
import { readMemory, sortAlerts, writeMemory } from './alertModel'

/**
 * D18: the alerts in force, as `AlertCenter` receives them, shared with the pages (the High Council
 * section lists them, Nova reacts to them). Remembers what this viewer read or folded away.
 */
interface AlertFeedState {
  /** sorted: what concerns me, then the most serious */
  alerts: ActiveAlert[]
  acknowledged: number[]
  dismissed: number[]
  /** an alert reopened from the banner or a list, shown again in full */
  reviewing: number | null
  receive: (alerts: ActiveAlert[]) => void
  acknowledge: (id: number) => void
  dismiss: (id: number) => void
  review: (id: number | null) => void
}

const remember = (state: Pick<AlertFeedState, 'acknowledged' | 'dismissed' | 'alerts'>) =>
  writeMemory({ acknowledged: state.acknowledged, dismissed: state.dismissed }, state.alerts.map((a) => a.id))

export const useAlertFeed = create<AlertFeedState>()((set, get) => ({
  alerts: [],
  ...readMemory(),
  reviewing: null,
  receive: (alerts) => {
    set({ alerts: sortAlerts(alerts) })
    remember(get())
  },
  acknowledge: (id) => {
    set((s) => ({ acknowledged: s.acknowledged.includes(id) ? s.acknowledged : [...s.acknowledged, id], reviewing: s.reviewing === id ? null : s.reviewing }))
    remember(get())
  },
  dismiss: (id) => {
    set((s) => ({ dismissed: [...s.dismissed, id] }))
    remember(get())
  },
  review: (id) => set({ reviewing: id }),
}))

/** The critical alert that concerns me, if any: it turns the city red and Nova reads its instructions. */
export const criticalAlertOf = (alerts: readonly ActiveAlert[]): ActiveAlert | null =>
  alerts.find((a) => a.concerns_me && a.severity === 'CRITICAL') ?? null
