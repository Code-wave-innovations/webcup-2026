import { useStoredChoice } from './storage'

// F50: which view of the dashboards the person chose, kept across reloads (both spaces share it)

export type DashboardView = 'simple' | 'detailed'

const VIEWS: readonly DashboardView[] = ['simple', 'detailed']

export const useDashboardView = () => useStoredChoice<DashboardView>('bo-dashboard-view', VIEWS, 'detailed')
