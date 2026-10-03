import type {
  AlertAudience,
  AlertSeverity,
  AnnouncementCategory,
  AppointmentStatus,
  AuditAction,
  InterruptionImpact,
  InterruptionType,
  PublicationStatus,
  RequestEventType,
  RequestPriority,
  RequestStatus,
  RequestType,
  Role,
} from '../mocks/types'

/** Visual tone shared by pills, dots and timeline stations. */
export type Tone = 'neutral' | 'ice' | 'ok' | 'progress' | 'taken' | 'alert' | 'ember'

export const STATUS_LABEL: Record<RequestStatus, string> = {
  SUBMITTED: 'Nouvelle',
  IN_REVIEW: 'En examen',
  IN_PROGRESS: 'En traitement',
  WAITING_CITIZEN: 'Attente citoyen',
  RESOLVED: 'Résolue',
  REJECTED: 'Refusée',
  CLOSED: 'Clôturée',
}

export const STATUS_TONE: Record<RequestStatus, Tone> = {
  SUBMITTED: 'ember',
  IN_REVIEW: 'taken',
  IN_PROGRESS: 'progress',
  WAITING_CITIZEN: 'neutral',
  RESOLVED: 'ok',
  REJECTED: 'alert',
  CLOSED: 'neutral',
}

export const STATUS_ORDER: RequestStatus[] = [
  'SUBMITTED',
  'IN_REVIEW',
  'IN_PROGRESS',
  'WAITING_CITIZEN',
  'RESOLVED',
  'REJECTED',
  'CLOSED',
]

// F22: the city still has to act
export const NEEDS_ACTION: RequestStatus[] = ['SUBMITTED', 'IN_REVIEW', 'IN_PROGRESS']
export const FINAL_STATUSES: RequestStatus[] = ['RESOLVED', 'REJECTED', 'CLOSED']

export const TYPE_LABEL: Record<RequestType, string> = {
  CONTACT: 'Message',
  PROCEDURE: 'Démarche',
  INCIDENT: 'Signalement',
}

export const PRIORITY_LABEL: Record<RequestPriority, string> = {
  LOW: 'Basse',
  NORMAL: 'Normale',
  HIGH: 'Haute',
  URGENT: 'Urgente',
}

export const PRIORITY_RANK: Record<RequestPriority, number> = { LOW: 0, NORMAL: 1, HIGH: 2, URGENT: 3 }

export const EVENT_LABEL: Record<RequestEventType, string> = {
  CREATED: 'Demande créée',
  STATUS_CHANGED: 'Changement d’état',
  ASSIGNED: 'Assignation',
  PRIORITY_CHANGED: 'Priorité modifiée',
  COMMENT: 'Message',
}

export const ROLE_LABEL: Record<Role, string> = { CITIZEN: 'Citoyen', AGENT: 'Agent', ADMIN: 'Administrateur' }

export const PUBLICATION_LABEL: Record<PublicationStatus, string> = {
  DRAFT: 'Brouillon',
  PUBLISHED: 'Publiée',
  ARCHIVED: 'Archivée',
}

export const ANNOUNCEMENT_CATEGORY_LABEL: Record<AnnouncementCategory, string> = {
  NEWS: 'Actualité',
  SERVICE_CHANGE: 'Changement de service',
  PRACTICAL_INFO: 'Info pratique',
  EVENT: 'Événement',
}

export const SEVERITY_LABEL: Record<AlertSeverity, string> = { INFO: 'Information', WARNING: 'Vigilance', CRITICAL: 'Critique' }
export const SEVERITY_TONE: Record<AlertSeverity, Tone> = { INFO: 'ice', WARNING: 'progress', CRITICAL: 'alert' }

export const AUDIENCE_LABEL: Record<AlertAudience | 'STAFF', string> = {
  ALL: 'Tous les habitants',
  DISTRICTS: 'Quartiers ciblés',
  VULNERABLE: 'Personnes vulnérables',
  STAFF: 'Personnel municipal',
}

export const INTERRUPTION_TYPE_LABEL: Record<InterruptionType, string> = { MAINTENANCE: 'Maintenance', INCIDENT: 'Incident' }
export const IMPACT_LABEL: Record<InterruptionImpact, string> = { DEGRADED: 'Service dégradé', UNAVAILABLE: 'Indisponible' }

export const APPOINTMENT_LABEL: Record<AppointmentStatus, string> = {
  BOOKED: 'Confirmé',
  CANCELLED: 'Annulé',
  COMPLETED: 'Honoré',
  NO_SHOW: 'Absent',
}
export const APPOINTMENT_TONE: Record<AppointmentStatus, Tone> = {
  BOOKED: 'ice',
  CANCELLED: 'neutral',
  COMPLETED: 'ok',
  NO_SHOW: 'alert',
}

export const AUDIT_LABEL: Record<AuditAction, string> = {
  'request.status_changed': 'a changé l’état de',
  'request.assigned': 'a assigné',
  'request.priority_changed': 'a changé la priorité de',
  'request.comment_added': 'a commenté',
  'user.created': 'a créé le compte',
  'user.updated': 'a modifié le compte',
  'user.role_changed': 'a changé le rôle de',
  'user.deactivated': 'a désactivé',
  'user.unlocked': 'a déverrouillé',
  'service.updated': 'a modifié le service',
  'service.featured': 'a mis en avant',
  'interruption.created': 'a déclaré une interruption sur',
  'announcement.published': 'a publié',
  'alert.created': 'a lancé l’alerte',
  'broadcast.sent': 'a diffusé',
  'translation.updated': 'a traduit',
  'slot.created': 'a publié',
  'appointment.updated': 'a mis à jour',
  'settings.updated': 'a modifié',
  'role.permission_changed': 'a changé les permissions du rôle',
  'auth.login': 's’est connecté·e',
}

export const AUDIT_DOMAIN: Record<string, string> = {
  CitizenRequest: 'Demandes',
  User: 'Comptes',
  CityService: 'Catalogue',
  ServiceInterruption: 'Catalogue',
  Announcement: 'Contenus',
  Alert: 'Contenus',
  Broadcast: 'Contenus',
  Appointment: 'Rendez-vous',
  AppointmentSlot: 'Rendez-vous',
  PlatformSettings: 'Paramètres',
  Role: 'Paramètres',
}

const VALUE_LABELS: Record<string, string> = {
  ...STATUS_LABEL,
  ...PRIORITY_LABEL,
  ...ROLE_LABEL,
  ...SEVERITY_LABEL,
  ...IMPACT_LABEL,
  ...PUBLICATION_LABEL,
  ...APPOINTMENT_LABEL,
  DISTRICTS: 'Quartiers ciblés',
  VULNERABLE: 'Personnes vulnérables',
  ALL: 'Tous les habitants',
  true: 'oui',
  false: 'non',
}

/** Human label for a raw audit value (enum codes, booleans); other values pass through. */
export const auditValue = (value: string | null) => (value === null ? '—' : (VALUE_LABELS[value] ?? value))
