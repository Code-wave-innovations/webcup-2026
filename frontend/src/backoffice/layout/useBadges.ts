import { useNow } from '../lib/useNow'
import { useAppointmentStore } from '../stores/appointmentStore'
import { useCatalogStore } from '../stores/catalogStore'
import { useContentStore } from '../stores/contentStore'
import { useRequestStore } from '../stores/requestStore'
import type { NavItem } from '../nav'

/** Live counters shown next to navigation entries. */
export function useBadges(): Record<NonNullable<NavItem['badge']>, number> {
  const now = useNow()
  const requests = useRequestStore((s) => s.requests)
  const appointments = useAppointmentStore((s) => s.appointments)
  const slots = useAppointmentStore((s) => s.slots)
  const alerts = useContentStore((s) => s.alerts)
  const interruptions = useCatalogStore((s) => s.interruptions)

  const today = new Date(now).toDateString()
  const slotDay = new Map(slots.map((s) => [s.id, new Date(s.starts_at).toDateString()]))

  return {
    awaiting: requests.filter((r) => r.status === 'SUBMITTED').length,
    appointmentsToday: appointments.filter((a) => a.status === 'BOOKED' && slotDay.get(a.slot_id) === today).length,
    activeAlerts: alerts.filter((a) => a.is_active).length,
    interruptions: interruptions.filter((i) => new Date(i.starts_at).getTime() <= now && (!i.ends_at || new Date(i.ends_at).getTime() > now)).length,
  }
}
