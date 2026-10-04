import type { Tone } from '../../ui/Badges'
import type { RequestStatus } from '../../api/types'
import type { SignalStatus } from '../../experience/director/directorStore'
import type { UrgencyHint } from '../../api/requests'

/** Categories the incident API stores as free text, and the agent already displays. */
export const CATEGORIES = ['Éclairage public', 'Voirie', 'Propreté et déchets', 'Eau et énergie', 'Sécurité', 'Transports', 'Autre'] as const

export const URGENCIES: ReadonlyArray<{ value: UrgencyHint; label: string }> = [
  { value: 'LOW', label: 'Faible' },
  { value: 'NORMAL', label: 'Moyenne' },
  { value: 'HIGH', label: 'Haute' },
]

export type Category = (typeof CATEGORIES)[number]

export const MIN_REPORT_LENGTH = 6
export const TITLE_LENGTH = 90
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024
const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

/** Life of a report as the citizen reads it, from reception to resolution. */
export const STATUSES: ReadonlyArray<{ name: string; tone: Tone; note: string }> = [
  { name: 'Reçue', tone: 'alert', note: 'Demande enregistrée.' },
  { name: 'En examen', tone: 'progress', note: 'Un service a pris votre demande.' },
  { name: 'En cours', tone: 'progress', note: 'Équipe sur place.' },
  { name: 'Résolue', tone: 'ok', note: 'Problème réglé.' },
]

export type ReportStatus = 0 | 1 | 2 | 3

/** Where a real request status sits on the four-step line, and the beam it lights. */
export function signalForStatus(status: RequestStatus): { index: ReportStatus; beam: SignalStatus; name: string; tone: Tone } {
  switch (status) {
    case 'SUBMITTED':
      return { index: 0, beam: 0, name: STATUSES[0].name, tone: STATUSES[0].tone }
    case 'IN_REVIEW':
      return { index: 1, beam: 1, name: STATUSES[1].name, tone: STATUSES[1].tone }
    case 'WAITING_CITIZEN':
      return { index: 1, beam: 1, name: 'Votre réponse est attendue', tone: 'alert' }
    case 'IN_PROGRESS':
      return { index: 2, beam: 2, name: STATUSES[2].name, tone: STATUSES[2].tone }
    case 'RESOLVED':
      return { index: 3, beam: 3, name: STATUSES[3].name, tone: STATUSES[3].tone }
    case 'CLOSED':
      return { index: 3, beam: 3, name: 'Clôturée', tone: 'ok' }
    case 'REJECTED':
      return { index: 0, beam: -1, name: 'Refusée', tone: 'alert' }
  }
}

export function urgencyLabel(hint: UrgencyHint): string {
  return URGENCIES.find((item) => item.value === hint)?.label ?? 'Moyenne'
}

/** First line of the report, long enough for the API subject and short enough for the list. */
export function reportSubject(text: string): string {
  const line = text.trim().replace(/\s+/g, ' ')
  const cut = line.length > TITLE_LENGTH ? `${line.slice(0, TITLE_LENGTH - 1).trimEnd()}…` : line
  return cut.charAt(0).toUpperCase() + cut.slice(1)
}

export function photoError(file: File): string | null {
  if (!PHOTO_TYPES.has(file.type)) return 'La photo doit être un JPG, un PNG ou un WebP.'
  if (file.size > MAX_PHOTO_BYTES) return 'La photo dépasse 10 Mo. Choisissez-en une plus légère.'
  return null
}
