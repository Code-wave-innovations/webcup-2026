import type { AuditChange, AuditEntry } from '../../api/types'
import { APPOINTMENT_LABEL, IMPACT_LABEL, PRIORITY_LABEL, PUBLICATION_LABEL, ROLE_LABEL, SEVERITY_LABEL, STATUS_LABEL } from './labels'

// F47 / F48: an audit entry read in one line, in French: « Ada R. · il y a 3 min · a modifié le
// service « Prévention santé » · priorité : 2 → 5 ». Unknown actions and fields fall back to their code.

const ACTIONS: Record<string, string> = {
  'request.status_changed': 'a changé l’état de la demande',
  'request.assigned': 'a assigné la demande',
  'request.priority_changed': 'a changé la priorité de la demande',
  'request.updated': 'a modifié la demande',
  'request.internal_note': 'a ajouté une note interne à la demande',
  'request.commented': 'a répondu sur la demande',
  'request.bulk_updated': 'a modifié en groupe',
  'request.deleted': 'a supprimé la demande',
  'user.created': 'a créé le compte',
  'user.updated': 'a modifié le compte',
  'user.role_changed': 'a changé le rôle de',
  'user.deactivated': 'a désactivé le compte',
  'user.reactivated': 'a réactivé le compte',
  'user.deleted': 'a supprimé le compte',
  'user.login_unlocked': 'a débloqué la connexion de',
  'user.self_deleted': 'Un habitant a supprimé son compte',
  'auth.staff_login': 's’est connecté·e',
  'security.new_device': 's’est connecté·e depuis un nouvel appareil',
  'security.sessions_revoked': 'a déconnecté tous les appareils de',
  'security.2fa_enabled': 'a activé la double vérification de',
  'security.2fa_disabled': 'a désactivé la double vérification de',
  'security.2fa_reset': 'a réinitialisé la double vérification de',
  'security.recovery_code_used': 'a utilisé un code de secours',
  'security.passkey_added': 'a ajouté une clé d’accès à',
  'security.passkey_revoked': 'a révoqué une clé d’accès de',
  'security.device_forgotten': 'a oublié un appareil de',
  'security.password_changed': 'a changé le mot de passe de',
  'permissions.updated': 'a modifié les droits de',
  'service.created': 'a créé le service',
  'service.updated': 'a modifié le service',
  'service.featured': 'a changé la mise en avant du service',
  'service.disabled': 'a coupé le service',
  'service.enabled': 'a rétabli le service',
  'service.deleted': 'a supprimé le service',
  'category.created': 'a créé la catégorie',
  'category.updated': 'a modifié la catégorie',
  'category.deleted': 'a supprimé la catégorie',
  'procedure.created': 'a créé la démarche',
  'procedure.updated': 'a modifié la démarche',
  'procedure.deleted': 'a supprimé la démarche',
  'district.created': 'a créé le quartier',
  'district.updated': 'a modifié le quartier',
  'district.deleted': 'a supprimé le quartier',
  'interruption.created': 'a déclaré une interruption sur',
  'interruption.updated': 'a modifié l’interruption de',
  'interruption.ended': 'a terminé l’interruption de',
  'interruption.deleted': 'a supprimé l’interruption de',
  'settings.updated': 'a modifié les',
  'translation.updated': 'a traduit',
  'translation.deleted': 'a supprimé une traduction de',
  'announcement.created': 'a créé l’annonce',
  'announcement.updated': 'a modifié l’annonce',
  'announcement.published': 'a publié l’annonce',
  'announcement.archived': 'a archivé l’annonce',
  'announcement.deleted': 'a supprimé l’annonce',
  'alert.created': 'a lancé l’alerte',
  'alert.updated': 'a modifié l’alerte',
  'alert.closed': 'a clôturé l’alerte',
  'alert.deleted': 'a supprimé l’alerte',
  'slot.created': 'a publié',
  'slot.updated': 'a modifié le créneau',
  'slot.deleted': 'a supprimé le créneau',
  'appointment.status': 'a changé l’état du rendez-vous',
  'appointment.notes': 'a annoté le rendez-vous',
  'reminders.run': 'a lancé l’envoi des rappels',
  'reminders.sent': 'Envoi automatique des rappels',
  'transit.line_created': 'a créé la',
  'transit.line_updated': 'a modifié la',
  'transit.line_status': 'a changé l’état de la',
  'transit.line_deleted': 'a supprimé la',
  'transit.stops': 'a modifié les arrêts de la',
  'transit.timetable': 'a modifié les horaires de la',
  'transit.stop_created': 'a créé l’arrêt',
  'transit.stop_updated': 'a modifié l’arrêt',
  'transit.stop_deleted': 'a supprimé l’arrêt',
  'audit.exported': 'a exporté le journal d’audit',
}

/** Families of actions, for the filters */
export const ACTION_FAMILIES: { value: string; label: string }[] = [
  { value: 'request.', label: 'Demandes' },
  { value: 'user.', label: 'Comptes' },
  { value: 'security.', label: 'Sécurité' },
  { value: 'auth.', label: 'Connexions' },
  { value: 'service.', label: 'Services' },
  { value: 'interruption.', label: 'Interruptions' },
  { value: 'procedure.', label: 'Démarches' },
  { value: 'announcement.', label: 'Annonces' },
  { value: 'alert.', label: 'Alertes' },
  { value: 'slot.', label: 'Créneaux' },
  { value: 'appointment.', label: 'Rendez-vous' },
  { value: 'transit.', label: 'Transports' },
  { value: 'settings.', label: 'Paramètres' },
  { value: 'audit.', label: 'Journal' },
]

/** Kinds of objects, for the filters */
export const ENTITIES: { value: string; label: string }[] = [
  { value: 'CitizenRequest', label: 'Demandes' },
  { value: 'User', label: 'Comptes' },
  { value: 'CityService', label: 'Services' },
  { value: 'ServiceInterruption', label: 'Interruptions' },
  { value: 'Procedure', label: 'Démarches' },
  { value: 'Announcement', label: 'Annonces' },
  { value: 'Alert', label: 'Alertes' },
  { value: 'AppointmentSlot', label: 'Créneaux' },
  { value: 'Appointment', label: 'Rendez-vous' },
  { value: 'TransitLine', label: 'Lignes' },
  { value: 'PlatformSetting', label: 'Paramètres' },
]

const FIELDS: Record<string, string> = {
  status: 'état',
  priority: 'priorité',
  assigned_agent: 'agent',
  role: 'rôle',
  is_active: 'actif',
  is_featured: 'mise en avant',
  is_vulnerable: 'personne vulnérable',
  name: 'nom',
  last_name: 'nom de famille',
  email: 'e-mail',
  phone: 'téléphone',
  address: 'adresse',
  password: 'mot de passe',
  district_id: 'quartier',
  locale: 'langue',
  summary: 'résumé',
  description: 'description',
  keywords: 'mots-clés',
  opening_hours: 'horaires',
  contact_phone: 'téléphone du service',
  contact_email: 'e-mail du service',
  availability: 'disponibilité',
  impact: 'impact',
  type: 'type',
  reason: 'motif',
  alternative: 'alternative',
  starts_at: 'début',
  ends_at: 'fin',
  severity: 'gravité',
  audience: 'destinataires',
  category: 'catégorie',
  title: 'titre',
  agent_notes: 'notes',
  status_message: 'message',
  capacity: 'capacité',
  registration_open: 'inscriptions ouvertes',
  maintenance_mode: 'mode maintenance',
  maintenance_message: 'message de maintenance',
  home_sections: 'blocs de l’accueil',
  two_factor_required_roles: 'double vérification obligatoire',
  reminder_default_minutes: 'délai de rappel',
}

const VALUES: Record<string, string> = {
  ...STATUS_LABEL,
  ...PRIORITY_LABEL,
  ...ROLE_LABEL,
  ...SEVERITY_LABEL,
  ...IMPACT_LABEL,
  ...PUBLICATION_LABEL,
  ...APPOINTMENT_LABEL,
  AVAILABLE: 'Disponible',
  DEGRADED: 'Perturbé',
  MAINTENANCE: 'Maintenance',
  INCIDENT: 'Incident',
  DISTRICTS: 'Quartiers ciblés',
  VULNERABLE: 'Personnes vulnérables',
  ALL: 'Tous les habitants',
}

export const auditField = (field: string) => FIELDS[field] ?? field.replace(/_/g, ' ')

export function auditValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (value === true) return 'oui'
  if (value === false) return 'non'
  if (Array.isArray(value)) return value.length ? value.map(auditValue).join(', ') : 'aucun'
  if (typeof value === 'object') return JSON.stringify(value)
  const text = String(value)
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) return new Date(text).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
  return VALUES[text] ?? text
}

/** « priorité : 2 → 5 », or « téléphone modifié » for masked personal data */
export function changeText(change: AuditChange): string {
  if ('masked' in change) return `${auditField(change.field)} modifié`
  if (change.from === null || change.from === undefined) return `${auditField(change.field)} : ${auditValue(change.to)}`
  return `${auditField(change.field)} : ${auditValue(change.from)} → ${auditValue(change.to)}`
}

export const actionText = (action: string) => ACTIONS[action] ?? action

/** Actions whose sentence already says who acted (system, anonymous self-deletion) */
export const isImpersonal = (entry: Pick<AuditEntry, 'actor_name'>) => entry.actor_name === null

/** « Ada R. » */
export const shortName = (name: string | null) => {
  if (!name) return 'Système'
  const [first, ...rest] = name.split(' ')
  return rest.length ? `${first} ${rest[rest.length - 1].charAt(0)}.` : first
}

/** Where an entry's object can be opened in the back-office, if anywhere */
export function entityLink(entry: Pick<AuditEntry, 'entity' | 'entity_id'>, base: '/agent' | '/admin'): string | null {
  if (entry.entity_id === null) return null
  switch (entry.entity) {
    case 'CitizenRequest':
      return `${base}/demandes/${entry.entity_id}`
    case 'User':
      return base === '/admin' ? `/admin/utilisateurs?compte=${entry.entity_id}` : `/agent/citoyens?compte=${entry.entity_id}`
    case 'CityService':
      return base === '/admin' ? `/admin/services?service=${entry.entity_id}` : null
    case 'ServiceInterruption':
      return base === '/admin' ? '/admin/maintenance' : null
    default:
      return null
  }
}
