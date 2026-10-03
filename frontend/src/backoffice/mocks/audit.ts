import type { AuditLog } from './types'
import { hoursAgo, minutesAgo } from './time'

let id = 1
const log = (at: string, entry: Omit<AuditLog, 'id' | 'at'>): AuditLog => ({ id: id++, at, ...entry })

// F47 / F48: who changed what, and when.
export const AUDIT_LOGS: AuditLog[] = [
  log(minutesAgo(2), { actor_id: 2, action: 'request.assigned', entity: 'CitizenRequest', entity_id: 12, entity_label: 'Panne de climatisation au foyer seniors', changes: [{ field: 'assigned_agent', before: null, after: 'Alex Rakoto' }], ip: '10.4.0.21' }),
  log(minutesAgo(6), { actor_id: 3, action: 'request.status_changed', entity: 'CitizenRequest', entity_id: 5, entity_label: 'Nid de poule dangereux', changes: [{ field: 'status', before: 'SUBMITTED', after: 'IN_REVIEW' }], ip: '10.4.0.33' }),
  log(minutesAgo(11), { actor_id: 1, action: 'service.featured', entity: 'CityService', entity_id: 5, entity_label: 'Réseau de transport urbain', changes: [{ field: 'is_featured', before: 'false', after: 'true' }], ip: '10.4.0.2' }),
  log(minutesAgo(19), { actor_id: 2, action: 'request.comment_added', entity: 'CitizenRequest', entity_id: 12, entity_label: 'Panne de climatisation au foyer seniors', changes: [{ field: 'note publique', before: null, after: 'Ventilateurs livrés en attendant le technicien.' }], ip: '10.4.0.21' }),
  log(minutesAgo(34), { actor_id: 1, action: 'user.unlocked', entity: 'User', entity_id: 17, entity_label: 'Miora Haja', changes: [{ field: 'verrouillage', before: 'verrouillé', after: 'déverrouillé' }], ip: '10.4.0.2' }),
  log(minutesAgo(48), { actor_id: 3, action: 'interruption.created', entity: 'ServiceInterruption', entity_id: 1, entity_label: 'Eau & énergie', changes: [{ field: 'impact', before: null, after: 'DEGRADED' }, { field: 'fin', before: null, after: 'demain' }], ip: '10.4.0.33' }),
  log(hoursAgo(1.2), { actor_id: 2, action: 'alert.created', entity: 'Alert', entity_id: 1, entity_label: 'Montée des eaux dans le Quartier Sud', changes: [{ field: 'severity', before: null, after: 'CRITICAL' }, { field: 'audience', before: null, after: 'Quartier Sud' }], ip: '10.4.0.21' }),
  log(hoursAgo(2), { actor_id: 1, action: 'user.role_changed', entity: 'User', entity_id: 4, entity_label: 'Tiana Rabe', changes: [{ field: 'role', before: 'CITIZEN', after: 'AGENT' }], ip: '10.4.0.2' }),
  log(hoursAgo(3), { actor_id: 4, action: 'request.status_changed', entity: 'CitizenRequest', entity_id: 7, entity_label: 'Dépôt sauvage de déchets', changes: [{ field: 'status', before: 'IN_PROGRESS', after: 'RESOLVED' }], ip: '10.4.0.47' }),
  log(hoursAgo(4.5), { actor_id: 1, action: 'settings.updated', entity: 'PlatformSettings', entity_id: null, entity_label: 'Sécurité des connexions', changes: [{ field: 'login_max_failures', before: '10', after: '5' }], ip: '10.4.0.2' }),
  log(hoursAgo(5), { actor_id: 1, action: 'broadcast.sent', entity: 'Broadcast', entity_id: 3, entity_label: 'Vague de chaleur : recommandations', changes: [{ field: 'destinataires', before: null, after: '87 personnes vulnérables' }], ip: '10.4.0.2' }),
  log(hoursAgo(7), { actor_id: 5, action: 'translation.updated', entity: 'CityService', entity_id: 3, entity_label: 'Centre de santé (mg)', changes: [{ field: 'name', before: null, after: 'Toeram-pahasalamana' }], ip: '10.4.0.9' }),
  log(hoursAgo(9), { actor_id: 2, action: 'appointment.updated', entity: 'Appointment', entity_id: 4, entity_label: 'RDV Lucas Meyer', changes: [{ field: 'status', before: 'BOOKED', after: 'NO_SHOW' }], ip: '10.4.0.21' }),
  log(hoursAgo(12), { actor_id: 1, action: 'user.created', entity: 'User', entity_id: 5, entity_label: 'Noa Fidy', changes: [{ field: 'role', before: null, after: 'ADMIN' }], ip: '10.4.0.2' }),
  log(hoursAgo(20), { actor_id: 3, action: 'announcement.published', entity: 'Announcement', entity_id: 3, entity_label: 'Collecte des encombrants : mode d’emploi', changes: [{ field: 'status', before: 'DRAFT', after: 'PUBLISHED' }], ip: '10.4.0.33' }),
  log(hoursAgo(26), { actor_id: 1, action: 'role.permission_changed', entity: 'Role', entity_id: null, entity_label: 'AGENT', changes: [{ field: 'citizens.manage', before: 'refusé', after: 'autorisé' }], ip: '10.4.0.2' }),
]

/** Simulated live activity: templates replayed by the audit store's ticker. */
export const LIVE_TEMPLATES: Omit<AuditLog, 'id' | 'at'>[] = [
  { actor_id: 3, action: 'request.status_changed', entity: 'CitizenRequest', entity_id: 10, entity_label: 'Fuite d’eau sur le trottoir', changes: [{ field: 'status', before: 'SUBMITTED', after: 'IN_REVIEW' }], ip: '10.4.0.33' },
  { actor_id: 4, action: 'appointment.updated', entity: 'Appointment', entity_id: 1, entity_label: 'RDV Pauline Ravelo', changes: [{ field: 'status', before: 'BOOKED', after: 'COMPLETED' }], ip: '10.4.0.47' },
  { actor_id: 2, action: 'request.priority_changed', entity: 'CitizenRequest', entity_id: 16, entity_label: 'Feu de signalisation éteint', changes: [{ field: 'priority', before: 'NORMAL', after: 'HIGH' }], ip: '10.4.0.21' },
  { actor_id: 14, action: 'auth.login', entity: 'User', entity_id: 14, entity_label: 'Sophie Nguyen', changes: [], ip: '41.188.12.7' },
  { actor_id: 3, action: 'slot.created', entity: 'AppointmentSlot', entity_id: null, entity_label: '12 créneaux — Centre de santé', changes: [{ field: 'créneaux', before: null, after: '12' }], ip: '10.4.0.33' },
]
