import type {
  AlertAudience,
  AlertSeverity,
  AnnouncementCategory,
  AppointmentStatus,
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

export const AUDIT_LABEL: Record<string, string> = {
  'request.status_changed': 'a changé l’état de',
  'request.assigned': 'a assigné',
  'request.priority_changed': 'a changé la priorité de',
  'request.internal_note': 'a ajouté une note interne sur',
  'request.comment_added': 'a écrit au citoyen sur',
  'request.deleted': 'a supprimé',
  'request.bulk_updated': 'a modifié en lot',
  'user.created': 'a créé le compte',
  'user.updated': 'a modifié le compte',
  'user.role_changed': 'a changé le rôle de',
  'user.deactivated': 'a désactivé',
  'user.reactivated': 'a réactivé',
  'user.deleted': 'a supprimé le compte',
  'user.login_unlocked': 'a déverrouillé',
  'user.self_deleted': 'a supprimé son compte',
  'user.unlocked': 'a déverrouillé',
  'service.created': 'a créé le service',
  'service.updated': 'a modifié le service',
  'service.featured': 'a mis en avant',
  'service.disabled': 'a mis hors ligne',
  'service.enabled': 'a remis en ligne',
  'service.deleted': 'a supprimé le service',
  'procedure.created': 'a créé la démarche',
  'procedure.updated': 'a modifié la démarche',
  'procedure.deleted': 'a supprimé la démarche',
  'category.created': 'a créé la catégorie',
  'category.updated': 'a modifié la catégorie',
  'category.deleted': 'a supprimé la catégorie',
  'interruption.created': 'a déclaré une interruption sur',
  'interruption.updated': 'a modifié l’interruption de',
  'interruption.ended': 'a clos l’interruption de',
  'interruption.deleted': 'a supprimé l’interruption de',
  'announcement.created': 'a créé',
  'announcement.updated': 'a modifié',
  'announcement.published': 'a publié',
  'announcement.archived': 'a archivé',
  'announcement.deleted': 'a supprimé',
  'alert.created': 'a lancé l’alerte',
  'alert.updated': 'a modifié l’alerte',
  'alert.closed': 'a clos l’alerte',
  'alert.deleted': 'a supprimé l’alerte',
  'broadcast.sent': 'a diffusé',
  'translation.updated': 'a traduit',
  'slot.created': 'a publié des créneaux pour',
  'slot.updated': 'a modifié un créneau de',
  'slot.deleted': 'a retiré un créneau de',
  'appointment.status': 'a mis à jour le rendez-vous',
  'appointment.notes': 'a annoté le rendez-vous',
  'appointment.updated': 'a mis à jour',
  'reminders.run': 'a envoyé les rappels de',
  'settings.updated': 'a modifié',
  'auth.staff_login': 's’est connecté·e',
  'audit.exported': 'a exporté',
  'transit.line_status': 'a modifié la ligne',
  'transit.stops': 'a modifié les arrêts de',
  'transit.timetable': 'a modifié les horaires de',
  'district.created': 'a créé le quartier',
  'district.updated': 'a modifié le quartier',
  'district.deleted': 'a supprimé le quartier',
  'security.new_device': 'a signalé un nouvel appareil pour',
  'security.sessions_revoked': 'a révoqué les sessions de',
  'security.2fa_enabled': 'a activé la double vérification de',
  'security.2fa_reset': 'a réinitialisé la double vérification de',
  'security.passkey_added': 'a ajouté une clé d’accès pour',
  'security.passkey_revoked': 'a révoqué une clé d’accès de',
  'role.permission_changed': 'a changé les permissions du rôle',
}

export const auditActionLabel = (action: string) => AUDIT_LABEL[action] ?? 'a enregistré une action sur'

export const AUDIT_DOMAIN: Record<string, string> = {
  CitizenRequest: 'Demandes',
  User: 'Comptes',
  CityService: 'Catalogue',
  ServiceCategory: 'Catalogue',
  Procedure: 'Catalogue',
  ServiceInterruption: 'Catalogue',
  Announcement: 'Contenus',
  Alert: 'Contenus',
  Broadcast: 'Contenus',
  Appointment: 'Rendez-vous',
  AppointmentSlot: 'Rendez-vous',
  TransitLine: 'Transports',
  TransitStop: 'Transports',
  PlatformSetting: 'Paramètres',
  AuditLog: 'Audit',
  District: 'Référentiels',
  Role: 'Paramètres',
}

export const auditDomains = () => [...new Set(Object.values(AUDIT_DOMAIN))]

export const entitiesForDomain = (domain: string) =>
  Object.entries(AUDIT_DOMAIN)
    .filter(([, label]) => label === domain)
    .map(([entity]) => entity)

const AUDIT_FIELDS: Record<string, string> = {
  status: 'état',
  priority: 'priorité',
  assigned_agent_id: 'agent',
  is_featured: 'mise en avant',
  is_active: 'actif',
  role: 'rôle',
  severity: 'gravité',
  audience: 'audience',
  impact: 'impact',
  type: 'type',
  phone: 'téléphone',
  address: 'adresse',
  name: 'nom',
  title: 'titre',
  summary: 'résumé',
  category: 'catégorie',
  is_important: 'importante',
  is_pinned: 'épinglée',
  capacity: 'places',
  location: 'lieu',
  registration_open: 'inscriptions',
  maintenance_mode: 'maintenance',
  status_message: 'message',
}

export const auditField = (field: string) => AUDIT_FIELDS[field] ?? field.replaceAll('_', ' ')

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
  DISRUPTED: 'Perturbée',
  INTERRUPTED: 'Interrompue',
  MAINTENANCE: 'Maintenance',
  INCIDENT: 'Incident',
  WEEKDAY: 'Semaine',
  SATURDAY: 'Samedi',
  SUNDAY: 'Dimanche',
}

/** Human label for a raw audit value (enum codes, booleans); other values pass through. */
export const auditValue = (value: string | null) => (value === null ? '—' : (VALUE_LABELS[value] ?? value))
