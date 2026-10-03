import type { RequestListItem } from '../../api/types'
import { fullName } from './lookups'

/** Who sent it: the account, the visitor without an account (D04), or a deleted account (F33). */
export function requesterLabel(r: Pick<RequestListItem, 'citizen' | 'contact_name' | 'contact_email'>): string {
  if (r.citizen) return fullName(r.citizen)
  if (r.contact_name || r.contact_email) return `Visiteur sans compte · ${r.contact_email ?? r.contact_name}`
  return 'Compte supprimé'
}

/** The state names the citizen reads (STATUS_LABELS on the server), used to preview the F49 notification. */
export const CITIZEN_STATUS_LABEL = {
  SUBMITTED: 'Envoyée',
  IN_REVIEW: 'En cours d’examen',
  IN_PROGRESS: 'En cours de traitement',
  WAITING_CITIZEN: 'En attente de votre réponse',
  RESOLVED: 'Résolue',
  REJECTED: 'Refusée',
  CLOSED: 'Clôturée',
} as const

/** F49: these changes must tell the citizen what to do or what was done (checked by the server too). */
export const EXPLAINED_STATUSES = ['WAITING_CITIZEN', 'REJECTED', 'RESOLVED'] as const
