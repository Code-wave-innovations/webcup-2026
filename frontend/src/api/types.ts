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
