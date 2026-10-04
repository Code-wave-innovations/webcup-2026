import type { RequestEventType, RequestStatus, RequestType } from './types'

export const CITIZEN_STATUS_LABEL: Record<RequestStatus, string> = {
  SUBMITTED: 'Reçue',
  IN_REVIEW: 'En examen',
  IN_PROGRESS: 'En cours',
  WAITING_CITIZEN: 'Votre réponse est attendue',
  RESOLVED: 'Résolue',
  REJECTED: 'Refusée',
  CLOSED: 'Clôturée',
}

export const TYPE_LABEL: Record<RequestType, string> = {
  CONTACT: 'Message',
  PROCEDURE: 'Démarche',
  INCIDENT: 'Signalement',
}

export const EVENT_TYPE_LABEL: Record<RequestEventType, string> = {
  CREATED: 'Demande reçue',
  STATUS_CHANGED: 'Statut mis à jour',
  ASSIGNED: 'Prise en charge',
  PRIORITY_CHANGED: 'Priorité modifiée',
  COMMENT: 'Message',
}

export const FRISE_STEPS = ['Reçue', 'En examen', 'En cours', 'Résolue'] as const

const INDEX: Record<RequestStatus, number> = {
  SUBMITTED: 0,
  IN_REVIEW: 1,
  IN_PROGRESS: 2,
  WAITING_CITIZEN: 2,
  RESOLVED: 3,
  CLOSED: 3,
  REJECTED: 3,
}

export const friseIndex = (status: RequestStatus) => INDEX[status]

export function friseTone(status: RequestStatus): 'progress' | 'waiting' | 'done' | 'rejected' {
  if (status === 'WAITING_CITIZEN') return 'waiting'
  if (status === 'REJECTED') return 'rejected'
  if (status === 'RESOLVED' || status === 'CLOSED') return 'done'
  return 'progress'
}

export function nextStepHint(status: RequestStatus): string {
  switch (status) {
    case 'SUBMITTED':
      return 'Un agent va prendre en charge votre demande'
    case 'IN_REVIEW':
      return 'Examen en cours par les services'
    case 'IN_PROGRESS':
      return 'Traitement en cours'
    case 'WAITING_CITIZEN':
      return 'Votre réponse est attendue'
    case 'RESOLVED':
      return 'Demande résolue'
    case 'REJECTED':
      return 'Demande refusée'
    case 'CLOSED':
      return 'Demande clôturée'
  }
}

const OPEN: RequestStatus[] = ['SUBMITTED', 'IN_REVIEW', 'IN_PROGRESS', 'WAITING_CITIZEN']
export const isOpenStatus = (status: RequestStatus) => OPEN.includes(status)
