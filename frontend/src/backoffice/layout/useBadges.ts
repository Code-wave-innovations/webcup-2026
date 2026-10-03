import { useDashboardStats } from '../../api/dashboard'
import { useInterruptions } from '../../api/interruptions'
import type { NavItem } from '../nav'

export type BadgeKey = NonNullable<NavItem['badge']>

/**
 * Live counters shown next to navigation entries, read from the API. A counter the API cannot give yet
 * stays undefined and is not shown: never a simulated number next to real ones.
 */
export function useBadges(): Partial<Record<BadgeKey, number>> {
  const stats = useDashboardStats()
  const interruptions = useInterruptions('current')
  return {
    // D17
    awaiting: stats.data?.requests.awaiting_pickup,
    // D18, F29, F31
    activeAlerts: stats.data?.platform.active_alerts,
    // F38
    interruptions: interruptions.data?.length,
    // F39
    appointmentsToday: stats.data?.appointments.today,
  }
}
