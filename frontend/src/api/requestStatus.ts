import { defineMessages, messagesFor, type Locale } from '../i18n'
import type { RequestEventType, RequestStatus, RequestType } from './types'

/*
  Citizen-facing wording of a request's life (the back-office has its own labels in backoffice/lib).
  The helpers read the current language when they are called: components that show them also call
  `useLocale()` / `useMessages()` so they re-render on a switch.
*/
export const requestStatusMessages = defineMessages(
  {
    status: {
      SUBMITTED: 'Reçue',
      IN_REVIEW: 'En examen',
      IN_PROGRESS: 'En cours',
      WAITING_CITIZEN: 'Votre réponse est attendue',
      RESOLVED: 'Résolue',
      REJECTED: 'Refusée',
      CLOSED: 'Clôturée',
    },
    type: {
      CONTACT: 'Message',
      PROCEDURE: 'Démarche',
      INCIDENT: 'Signalement',
    },
    event: {
      CREATED: 'Demande reçue',
      STATUS_CHANGED: 'Statut mis à jour',
      ASSIGNED: 'Prise en charge',
      PRIORITY_CHANGED: 'Priorité modifiée',
      COMMENT: 'Message',
    },
    frise: ['Reçue', 'En examen', 'En cours', 'Résolue'],
    hint: {
      SUBMITTED: 'Un agent va prendre en charge votre demande',
      IN_REVIEW: 'Examen en cours par les services',
      IN_PROGRESS: 'Traitement en cours',
      WAITING_CITIZEN: 'Votre réponse est attendue',
      RESOLVED: 'Demande résolue',
      REJECTED: 'Demande refusée',
      CLOSED: 'Demande clôturée',
    },
  },
  {
    status: {
      SUBMITTED: 'Received',
      IN_REVIEW: 'Under review',
      IN_PROGRESS: 'In progress',
      WAITING_CITIZEN: 'Your reply is needed',
      RESOLVED: 'Resolved',
      REJECTED: 'Declined',
      CLOSED: 'Closed',
    },
    type: {
      CONTACT: 'Message',
      PROCEDURE: 'Procedure',
      INCIDENT: 'Report',
    },
    event: {
      CREATED: 'Request received',
      STATUS_CHANGED: 'Status updated',
      ASSIGNED: 'Taken on',
      PRIORITY_CHANGED: 'Priority changed',
      COMMENT: 'Message',
    },
    frise: ['Received', 'Under review', 'In progress', 'Resolved'],
    hint: {
      SUBMITTED: 'An agent will take on your request',
      IN_REVIEW: 'Being reviewed by the services',
      IN_PROGRESS: 'Being handled',
      WAITING_CITIZEN: 'Your reply is needed',
      RESOLVED: 'Request resolved',
      REJECTED: 'Request declined',
      CLOSED: 'Request closed',
    },
  },
)

export const statusLabel = (status: RequestStatus, locale?: Locale) => messagesFor(requestStatusMessages, locale).status[status]

export const typeLabel = (type: RequestType, locale?: Locale) => messagesFor(requestStatusMessages, locale).type[type]

export const eventTypeLabel = (type: RequestEventType, locale?: Locale) => messagesFor(requestStatusMessages, locale).event[type]

/** The four steps of the progress strip. */
export const friseSteps = (locale?: Locale) => messagesFor(requestStatusMessages, locale).frise

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

export const nextStepHint = (status: RequestStatus, locale?: Locale) => messagesFor(requestStatusMessages, locale).hint[status]

const OPEN: RequestStatus[] = ['SUBMITTED', 'IN_REVIEW', 'IN_PROGRESS', 'WAITING_CITIZEN']
export const isOpenStatus = (status: RequestStatus) => OPEN.includes(status)
