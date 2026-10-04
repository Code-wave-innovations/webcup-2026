import type { Availability } from '../../api/types'
import type { Tone } from '../../ui/Badges'

const MOMENT = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
const SHORT_DAY = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
const TIME = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })

/** "lundi 5 octobre à 07:00" (the process time zone, like the backend's labels) */
export const formatMoment = (iso: string): string => MOMENT.format(new Date(iso))

/** "lun. 5 oct. à 07:00", for the tiles */
export const formatShortMoment = (iso: string): string => {
  const date = new Date(iso)
  return `${SHORT_DAY.format(date)} à ${TIME.format(date)}`
}

export interface AvailabilityView {
  status: Availability['status']
  tone: Tone
  /** always shown as text: the state is never told by the colour alone (F38) */
  label: string
  /** when it comes back, or why it is worth knowing */
  detail: string | null
}

/** F38: how a service's availability reads for a resident. */
export function availabilityView(availability: Availability): AvailabilityView {
  const back = availability.back_at ? `jusqu'au ${formatShortMoment(availability.back_at)}` : "jusqu'à nouvel ordre"
  switch (availability.status) {
    case 'UNAVAILABLE':
      return { status: 'UNAVAILABLE', tone: 'alert', label: 'Indisponible', detail: back }
    case 'DEGRADED':
      return { status: 'DEGRADED', tone: 'progress', label: 'Perturbé', detail: back }
    default: {
      const next = availability.upcoming[0]
      return { status: 'AVAILABLE', tone: 'ok', label: 'Ouvert', detail: next ? `Interruption prévue ${formatShortMoment(next.starts_at)}` : null }
    }
  }
}

/** "≈ 3 jours", "Immédiat" */
export function formatDelay(days: number | null): string | null {
  if (days === null) return null
  if (days <= 0) return 'Immédiat'
  return days === 1 ? '≈ 1 jour' : `≈ ${days} jours`
}

export const plural = (count: number, one: string, many: string) => `${count} ${count > 1 ? many : one}`
