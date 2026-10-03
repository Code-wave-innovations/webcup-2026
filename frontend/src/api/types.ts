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

/* ─── Staff dashboard (D17, D19) ─────────────────────────────────────────── */

export interface DashboardStats {
  requests: {
    /** D17: submitted, nobody took them yet */
    awaiting_pickup: number
    needs_action: number
    open: number
    unassigned_open: number
    assigned_to_me: number
    oldest_awaiting: { id: number; reference: string; created_at: string } | null
    by_status: Record<string, number>
    open_by_type: Record<string, number>
    open_by_priority: Record<string, number>
  }
  /** highest priority first, then oldest (typed by BO-01) */
  queue: unknown[]
  platform: {
    citizens: number
    active_alerts: number
    published_announcements: number
  }
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
