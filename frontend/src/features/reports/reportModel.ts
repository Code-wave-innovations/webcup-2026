import type { Tone } from '../../ui/Badges'
import type { RequestStatus } from '../../api/types'
import type { SignalStatus } from '../../experience/director/directorStore'
import type { UrgencyHint } from '../../api/requests'
import { defineMessages, messagesFor, type Locale } from '../../i18n'

/** Categories the incident API stores as free text, and the agent already displays. */
export const CATEGORIES = ['Éclairage public', 'Voirie', 'Propreté et déchets', 'Eau et énergie', 'Sécurité', 'Transports', 'Autre'] as const

export const URGENCIES: readonly UrgencyHint[] = ['LOW', 'NORMAL', 'HIGH']

export type Category = (typeof CATEGORIES)[number]

/*
  D14: what the citizen reads. The category stays stored in French (the value the API and the agents
  know); only its label follows the language.
*/
export const reportMessages = defineMessages(
  {
    category: {
      'Éclairage public': 'Éclairage public',
      Voirie: 'Voirie',
      'Propreté et déchets': 'Propreté et déchets',
      'Eau et énergie': 'Eau et énergie',
      Sécurité: 'Sécurité',
      Transports: 'Transports',
      Autre: 'Autre',
    } satisfies Record<Category, string>,
    urgency: { LOW: 'Faible', NORMAL: 'Moyenne', HIGH: 'Haute' } satisfies Record<UrgencyHint, string>,
    steps: {
      received: 'Reçue',
      receivedNote: 'Demande enregistrée.',
      review: 'En examen',
      reviewNote: 'Un service a pris votre demande.',
      progress: 'En cours',
      progressNote: 'Équipe sur place.',
      resolved: 'Résolue',
      resolvedNote: 'Problème réglé.',
      waiting: 'Votre réponse est attendue',
      closed: 'Clôturée',
      rejected: 'Refusée',
    },
    photoType: 'La photo doit être un JPG, un PNG ou un WebP.',
    photoSize: 'La photo dépasse 10 Mo. Choisissez-en une plus légère.',
  },
  {
    category: {
      'Éclairage public': 'Street lighting',
      Voirie: 'Roads',
      'Propreté et déchets': 'Cleanliness and waste',
      'Eau et énergie': 'Water and energy',
      Sécurité: 'Safety',
      Transports: 'Transport',
      Autre: 'Other',
    },
    urgency: { LOW: 'Low', NORMAL: 'Medium', HIGH: 'High' },
    steps: {
      received: 'Received',
      receivedNote: 'Request recorded.',
      review: 'Under review',
      reviewNote: 'A service has picked up your request.',
      progress: 'In progress',
      progressNote: 'A team is on site.',
      resolved: 'Resolved',
      resolvedNote: 'Problem fixed.',
      waiting: 'Your reply is needed',
      closed: 'Closed',
      rejected: 'Declined',
    },
    photoType: 'The photo must be a JPG, a PNG or a WebP.',
    photoSize: 'The photo is over 10 MB. Choose a lighter one.',
  },
)

/** A category's label; anything the list does not know (an older free text) is shown as stored. */
export function categoryLabel(category: string, locale?: Locale): string {
  const labels: Record<string, string> = messagesFor(reportMessages, locale).category
  return labels[category] ?? category
}

export const MIN_REPORT_LENGTH = 6
export const TITLE_LENGTH = 90
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024
const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

/** Life of a report as the citizen reads it, from reception to resolution. */
export function reportSteps(locale?: Locale): ReadonlyArray<{ name: string; tone: Tone; note: string }> {
  const m = messagesFor(reportMessages, locale).steps
  return [
    { name: m.received, tone: 'alert', note: m.receivedNote },
    { name: m.review, tone: 'progress', note: m.reviewNote },
    { name: m.progress, tone: 'progress', note: m.progressNote },
    { name: m.resolved, tone: 'ok', note: m.resolvedNote },
  ]
}

export type ReportStatus = 0 | 1 | 2 | 3

/** Where a real request status sits on the four-step line, and the beam it lights (named in the current language). */
export function signalForStatus(status: RequestStatus, locale?: Locale): { index: ReportStatus; beam: SignalStatus; name: string; tone: Tone } {
  const steps = reportSteps(locale)
  const m = messagesFor(reportMessages, locale).steps
  switch (status) {
    case 'SUBMITTED':
      return { index: 0, beam: 0, name: steps[0].name, tone: steps[0].tone }
    case 'IN_REVIEW':
      return { index: 1, beam: 1, name: steps[1].name, tone: steps[1].tone }
    case 'WAITING_CITIZEN':
      return { index: 1, beam: 1, name: m.waiting, tone: 'alert' }
    case 'IN_PROGRESS':
      return { index: 2, beam: 2, name: steps[2].name, tone: steps[2].tone }
    case 'RESOLVED':
      return { index: 3, beam: 3, name: steps[3].name, tone: steps[3].tone }
    case 'CLOSED':
      return { index: 3, beam: 3, name: m.closed, tone: 'ok' }
    case 'REJECTED':
      return { index: 0, beam: -1, name: m.rejected, tone: 'alert' }
  }
}

export function urgencyLabel(hint: UrgencyHint, locale?: Locale): string {
  const labels = messagesFor(reportMessages, locale).urgency
  return labels[hint] ?? labels.NORMAL
}

/** First line of the report, long enough for the API subject and short enough for the list. */
export function reportSubject(text: string): string {
  const line = text.trim().replace(/\s+/g, ' ')
  const cut = line.length > TITLE_LENGTH ? `${line.slice(0, TITLE_LENGTH - 1).trimEnd()}…` : line
  return cut.charAt(0).toUpperCase() + cut.slice(1)
}

export function photoError(file: File, locale?: Locale): string | null {
  const m = messagesFor(reportMessages, locale)
  if (!PHOTO_TYPES.has(file.type)) return m.photoType
  if (file.size > MAX_PHOTO_BYTES) return m.photoSize
  return null
}
