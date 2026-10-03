import { create } from 'zustand'
import { ROLE_PERMISSIONS, SETTINGS, TRANSLATIONS } from '../mocks/config'
import type { PlatformSettings, Role, TranslationEntry } from '../mocks/types'
import { toast } from './toastStore'

interface ConfigState {
  rolePermissions: Record<Role, string[]>
  settings: PlatformSettings
  translations: TranslationEntry[]
}

export const useConfigStore = create<ConfigState>()(() => ({
  rolePermissions: ROLE_PERMISSIONS,
  settings: SETTINGS,
  translations: TRANSLATIONS,
}))

/* Simulated platform configuration (D07, D08, D14, F27). */

export function togglePermission(role: Role, permission: string) {
  const current = useConfigStore.getState().rolePermissions[role]
  const granted = current.includes(permission)
  useConfigStore.setState((s) => ({
    rolePermissions: {
      ...s.rolePermissions,
      [role]: granted ? current.filter((p) => p !== permission) : [...current, permission],
    },
  }))
  toast(`${permission} ${granted ? 'retirée' : 'accordée'} au rôle ${role}`, granted ? 'alert' : 'ok')
}

export function updateSettings(change: Partial<PlatformSettings>, label: string) {
  useConfigStore.setState((s) => ({ settings: { ...s.settings, ...change } }))
  toast(`${label} : paramètre enregistré`)
}

export function saveTranslation(entity: string, entityId: number, locale: string, fields: Record<string, string>) {
  const entry = useConfigStore.getState().translations.find((t) => t.entity === entity && t.entity_id === entityId)
  if (!entry) return
  useConfigStore.setState((s) => ({
    translations: s.translations.map((t) =>
      t === entry ? { ...t, translations: { ...t.translations, [locale]: { ...t.translations[locale], ...fields } } } : t,
    ),
  }))
  toast(`Traduction ${locale.toUpperCase()} enregistrée`)
}
