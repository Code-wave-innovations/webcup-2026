/*
  Contracts of the Express API (endpoints listed in backend/README.md). Dates are ISO strings, as they
  arrive in JSON. Each plan adds the types of the domain it binds; until then the back-office keeps
  its simulated shapes in backoffice/mocks/types.ts.
*/

export type Role = 'CITIZEN' | 'AGENT' | 'ADMIN'

export interface PageMeta {
  page: number
  limit: number
  total: number
  pages: number
}

/** Paginated lists: `?page=&limit=` in, `{ data, meta }` out. */
export interface Paginated<T> {
  data: T[]
  meta: PageMeta
}

/** An account as returned by /api/auth, /api/me and /api/users (never the password hash). */
export interface User {
  id: number
  created_at: string
  updated_at: string
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
  /** F21/F23/F24: display preferences, free-form */
  preferences: Record<string, unknown> | null
  last_login_at: string | null
  /** included by /api/users and /api/me */
  district?: District | null
}

/** POST /api/auth/login and /api/auth/register */
export interface AuthResponse {
  token: string
  user: User
  /** F37: login only */
  security?: { failed_attempts_since_last_login: number }
}

/* ─── Platform settings (D07, D08; backend/src/lib/settings.ts) ─────────── */

export interface HomeSection {
  key: string
  label: string
  enabled: boolean
}

export interface PlatformSettings {
  registration_open: boolean
  maintenance_mode: boolean
  maintenance_message: string
  home_sections: HomeSection[]
  support_contact: { phone: string; email: string; hours: string; address: string }
  emergency_numbers: { label: string; number: string }[]
  reminder_default_minutes: number
}

/** F37: login protection thresholds, fixed on the server. */
export interface SecurityPolicy {
  max_account_failures: number
  max_ip_failures: number
  window_minutes: number
  lock_minutes: number
}

export interface SettingChange {
  updated_at: string
  updated_by: Pick<User, 'id' | 'name' | 'last_name'> | null
}

/** GET/PATCH /api/settings (admin) */
export interface SettingsAdminView {
  settings: PlatformSettings
  security: SecurityPolicy
  /** who changed each key last; keys still on their default are absent */
  updated: Partial<Record<keyof PlatformSettings, SettingChange>>
}

/* ─── Notifications (F30; also D16, F37, F40, F49 notices) ──────────────── */

export interface AppNotification {
  id: number
  created_at: string
  /** REQUEST_UPDATE, REQUEST_MESSAGE, SECURITY, APPOINTMENT_REMINDER, SERVICE_INTERRUPTION… */
  type: string
  title: string
  body: string | null
  /** route of the citizen space (/requests/12…), translated by each space */
  link: string | null
  data: Record<string, unknown> | null
  read_at: string | null
}

/** GET /api/notifications: a page, plus the unread total */
export interface NotificationPage {
  data: AppNotification[]
  meta: PageMeta & { unread: number }
}

/* ─── Citizen requests (D04, D11, F25) ───────────────────────────────────── */

export type RequestType = 'CONTACT' | 'PROCEDURE' | 'INCIDENT'
export type RequestStatus = 'SUBMITTED' | 'IN_REVIEW' | 'IN_PROGRESS' | 'WAITING_CITIZEN' | 'RESOLVED' | 'REJECTED' | 'CLOSED'
export type RequestPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'

type Person = Pick<User, 'id' | 'name' | 'last_name' | 'email'>

export interface District {
  id: number
  code: string
  name: string
}

/** A request as listed (requestListInclude on the server): every column plus its relations. */
export interface RequestListItem {
  id: number
  created_at: string
  updated_at: string
  /** D16: e.g. NT-261003-4F9A2C */
  reference: string
  type: RequestType
  status: RequestStatus
  priority: RequestPriority
  subject: string
  message: string
  /** null: sent by a visitor without an account (D04), or the account was deleted (F33) */
  citizen_id: number | null
  contact_name: string | null
  contact_email: string | null
  service_id: number | null
  procedure_id: number | null
  assigned_agent_id: number | null
  /** F25 */
  category: string | null
  district_id: number | null
  location_label: string | null
  latitude: number | null
  longitude: number | null
  attachment: string | null
  /** answers to the procedure form; `urgency_hint` is the urgency the citizen suggested */
  data: Record<string, unknown> | null
  resolved_at: string | null
  service: { id: number; slug: string; name: string } | null
  procedure: { id: number; slug: string; title: string } | null
  district: District | null
  citizen: Person | null
  assigned_agent: Person | null
  _count?: { events: number }
}

export type RequestEventType = 'CREATED' | 'STATUS_CHANGED' | 'ASSIGNED' | 'PRIORITY_CHANGED' | 'COMMENT'

/** D11: one step of a request. Internal steps are only sent to the staff. */
export interface RequestEvent {
  id: number
  created_at: string
  request_id: number
  author_id: number | null
  type: RequestEventType
  from_status: RequestStatus | null
  to_status: RequestStatus | null
  /** the note; for ASSIGNED the assignee's name, for PRIORITY_CHANGED the new priority */
  message: string | null
  is_internal: boolean
  author: (Pick<User, 'id' | 'name' | 'last_name' | 'role'>) | null
}

/** GET /api/requests/:id */
export interface RequestDetail extends RequestListItem {
  events: RequestEvent[]
}

/** PATCH /api/requests/:id */
export interface UpdatedRequest extends RequestListItem {
  /** F49: the citizen received a notification (account + public change) */
  citizen_notified: boolean
}

/** A member of staff a request can be assigned to (GET /api/users/staff) */
export type StaffMember = Pick<User, 'id' | 'name' | 'last_name' | 'email' | 'role'>

/** What a member of staff did on a request (GET /api/dashboard/activity) */
export interface StaffActivity {
  id: number
  created_at: string
  type: RequestEventType
  from_status: RequestStatus | null
  to_status: RequestStatus | null
  message: string | null
  is_internal: boolean
  author: Pick<User, 'id' | 'name' | 'last_name' | 'role'>
  request: { id: number; reference: string; subject: string }
}

/* ─── Staff dashboard (D17, D19, F50) ────────────────────────────────────── */

export interface DashboardStats {
  requests: {
    /** D17: submitted, nobody took them yet */
    awaiting_pickup: number
    needs_action: number
    open: number
    unassigned_open: number
    assigned_to_me: number
    oldest_awaiting: AwaitingRequest | null
    /** the three oldest awaiting requests */
    oldest_awaiting_list: AwaitingRequest[]
    by_status: Record<string, number>
    open_by_type: Record<string, number>
    open_by_priority: Record<string, number>
    /** open requests needing action, per assigned agent, busiest first */
    open_by_agent: { agent: Pick<User, 'id' | 'name' | 'last_name'>; count: number }[]
    overdue_count: number
    /** past the delay of their priority, most serious first (20 at most) */
    overdue: RequestListItem[]
    /** F25: open incident reports per district id ("none": no district) */
    incidents_by_district: Record<string, number>
  }
  /** F39: appointments of the day (not cancelled), including those still to come */
  appointments: { today: number }
  /** the 10 requests needing action, highest priority first, then oldest */
  queue: RequestListItem[]
  platform: {
    citizens: number
    active_alerts: number
    published_announcements: number
  }
}

export interface AwaitingRequest {
  id: number
  reference: string
  subject: string
  priority: RequestPriority
  created_at: string
}

type ByType = Record<RequestType, number> & { total: number }

/** GET /api/dashboard/trends?days= (D19), days and hours in the server time zone */
export interface DashboardTrends {
  from: string
  to: string
  days: number
  daily: {
    /** YYYY-MM-DD */
    date: string
    created: ByType
    resolved: ByType
    new_citizens: number
    appointments: number
    median_pickup_hours: number | null
  }[]
  /** median delay between submission and the first pickup by staff */
  median_pickup_hours: number | null
  pickup_by_service: { service_id: number; name: string; median_hours: number; count: number }[]
  /** weekday (Monday first) × 2-hour block */
  heatmap: { requests: number[][]; staff_actions: number[][] }
}

export type SummaryPeriod = 'today' | '7d' | '30d'

export interface Indicator {
  value: number
  /** same span just before; null for snapshots */
  previous: number | null
}

export type WatchKind = 'overdue_request' | 'service_unavailable' | 'service_degraded' | 'active_alert'

/** GET /api/dashboard/summary?period= (F50) */
export interface DashboardSummary {
  period: { key: SummaryPeriod; from: string; to: string; previous_from: string; previous_to: string }
  indicators: {
    requests_received: Indicator
    requests_resolved: Indicator
    awaiting_pickup: Indicator & { oldest_at: string | null }
    overdue: Indicator
    median_pickup_hours: { value: number | null; previous: number | null }
    appointments: Indicator & { no_show: number }
    new_citizens: Indicator
  }
  /** at most 5, most serious first; labels written by the server */
  watch: { kind: WatchKind; severity: 'critical' | 'warning'; label: string; link: string | null }[]
}

/* ─── Alerts (D18, F29, F31) ─────────────────────────────────────────────── */

export interface ActiveAlert {
  id: number
  title: string
  message: string
  category: string
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
  audience: 'ALL' | 'DISTRICTS' | 'VULNERABLE'
  starts_at: string
  ends_at: string | null
  districts: { id: number; code: string; name: string }[]
}

/* ─── Terra Nova feed (D19) ──────────────────────────────────────────────── */

/** One request of the official Terra Nova API */
export interface TerraNovaRequest {
  id: number
  request_code: string
  requester_name: string
  requester_type: string
  message_public: string
  difficulty: 'Facile' | 'Moyenne' | 'Difficile' | 'Expert' | (string & {})
  /** 1 (Facile) … 4 (Expert) */
  difficulty_level: number
  xp_total: number
  group_name: string
  /** null for the initial requests */
  wave_number: number | null
  sort_order: number
  is_initial: boolean
  is_ai_request: boolean
}

export interface TerraNovaSession {
  status: string
  is_running: boolean
  current_wave: number
  elapsed_minutes: number
  visible_requests_count: number
  next_wave_number: number
  minutes_until_next_wave: number
}

/** GET /api/terra-nova/requests: the upstream payload, cached 60 s by the server */
export interface TerraNovaFeed {
  /** when the server fetched it: minutes_until_next_wave counts from there */
  fetched_at: string
  cached: boolean
  data: { api_version: string; session: TerraNovaSession; requests: TerraNovaRequest[] }
}

/* ─── Service interruptions (F38) ────────────────────────────────────────── */

export type InterruptionScope = 'current' | 'upcoming' | 'active' | 'all'

export interface ServiceInterruption {
  id: number
  created_at: string
  updated_at: string
  service_id: number
  created_by_id: number | null
  type: 'MAINTENANCE' | 'INCIDENT'
  impact: 'DEGRADED' | 'UNAVAILABLE'
  reason: string
  alternative: string | null
  starts_at: string
  ends_at: string | null
  service: { id: number; slug: string; name: string }
  created_by: Pick<User, 'id' | 'name' | 'last_name'> | null
}
