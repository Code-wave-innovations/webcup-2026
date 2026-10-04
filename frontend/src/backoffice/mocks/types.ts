/*
  Shapes mirrored from the backend (backend/prisma/schema.prisma and the /api responses), so the
  simulated stores can later be swapped for API calls without touching the screens.
  Dates are ISO strings, as they arrive in JSON.
*/

export type Role = 'CITIZEN' | 'AGENT' | 'ADMIN'
export type Persona = 'AGENT' | 'ADMIN'

export interface District {
  id: number
  code: string
  name: string
}

export interface User {
  id: number
  email: string
  name: string
  last_name: string
  phone: string | null
  address: string | null
  district_id: number | null
  role: Role
  locale: string
  is_vulnerable: boolean
  is_active: boolean
  onboarding_completed: boolean
  created_at: string
  last_login_at: string | null
  /** F37: currently locked after repeated failed logins */
  login_locked?: boolean
}

export type RequestType = 'CONTACT' | 'PROCEDURE' | 'INCIDENT'
export type RequestStatus =
  | 'SUBMITTED'
  | 'IN_REVIEW'
  | 'IN_PROGRESS'
  | 'WAITING_CITIZEN'
  | 'RESOLVED'
  | 'REJECTED'
  | 'CLOSED'
export type RequestPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
export type RequestEventType = 'CREATED' | 'STATUS_CHANGED' | 'ASSIGNED' | 'PRIORITY_CHANGED' | 'COMMENT'

export interface RequestEvent {
  id: number
  created_at: string
  type: RequestEventType
  author_id: number | null
  from_status: RequestStatus | null
  to_status: RequestStatus | null
  message: string | null
  is_internal: boolean
}

export interface CitizenRequest {
  id: number
  reference: string
  type: RequestType
  status: RequestStatus
  priority: RequestPriority
  subject: string
  message: string
  citizen_id: number | null
  contact_name: string | null
  contact_email: string | null
  service_id: number | null
  procedure_title: string | null
  assigned_agent_id: number | null
  category: string | null
  district_id: number | null
  location_label: string | null
  latitude: number | null
  longitude: number | null
  attachment: string | null
  data: Record<string, string> | null
  created_at: string
  updated_at: string
  resolved_at: string | null
  events: RequestEvent[]
}

export interface ServiceCategory {
  id: number
  slug: string
  name: string
}

export interface CityService {
  id: number
  slug: string
  category_id: number
  name: string
  summary: string
  icon: string
  is_featured: boolean
  priority: number
  view_count: number
  is_active: boolean
  contact_phone: string | null
  address: string | null
}

export type InterruptionType = 'MAINTENANCE' | 'INCIDENT'
export type InterruptionImpact = 'DEGRADED' | 'UNAVAILABLE'

export interface ServiceInterruption {
  id: number
  service_id: number
  type: InterruptionType
  impact: InterruptionImpact
  reason: string
  alternative: string | null
  starts_at: string
  ends_at: string | null
  created_by_id: number | null
}

export type PublicationStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
export type AnnouncementCategory = 'NEWS' | 'SERVICE_CHANGE' | 'PRACTICAL_INFO' | 'EVENT'

export interface Announcement {
  id: number
  title: string
  summary: string | null
  content: string
  category: AnnouncementCategory
  status: PublicationStatus
  is_important: boolean
  is_pinned: boolean
  author_id: number | null
  published_at: string | null
  created_at: string
}

export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL'
export type AlertAudience = 'ALL' | 'DISTRICTS' | 'VULNERABLE'

export interface Alert {
  id: number
  title: string
  message: string
  category: string
  severity: AlertSeverity
  audience: AlertAudience
  district_ids: number[]
  instructions: string | null
  recommendations: string[]
  source: string | null
  starts_at: string
  ends_at: string | null
  is_active: boolean
  notified: number
}

/** F30: a global broadcast (one row per send; the backend fans it out as Notification rows). */
export interface Broadcast {
  id: number
  title: string
  body: string
  audience: AlertAudience | 'STAFF'
  district_ids: number[]
  recipients: number
  read_rate: number
  sent_at: string
  author_id: number
}

export type AppointmentStatus = 'BOOKED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW'

export interface AppointmentSlot {
  id: number
  service_id: number
  agent_id: number | null
  starts_at: string
  ends_at: string
  location: string
  capacity: number
  preparation_notes: string | null
  is_active: boolean
}

export interface Appointment {
  id: number
  reference: string
  slot_id: number
  citizen_id: number | null
  service_id: number
  reason: string
  status: AppointmentStatus
  agent_notes: string | null
  reminder_offset_minutes: number
  reminder_sent_at: string | null
}

export interface TranslationEntry {
  entity: string
  entity_id: number
  label: string
  fields: Record<string, string>
  /** locale -> field -> value */
  translations: Record<string, Record<string, string>>
}

export interface PlatformSettings {
  home_sections: { key: string; label: string; enabled: boolean }[]
  default_locale: string
  enabled_locales: string[]
  registration_open: boolean
  maintenance_mode: boolean
  login_max_failures: number
  login_lock_minutes: number
  reminder_default_minutes: number
}
