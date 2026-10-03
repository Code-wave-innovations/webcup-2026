import { create } from 'zustand'
import { ROLE_PERMISSIONS, SETTINGS, TRANSLATIONS } from '../mocks/config'
import type { PlatformSettings, Role, TranslationEntry } from '../mocks/types'
import { recordAudit } from './auditStore'
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

export function togglePermission(role: Role, permission: string, actorId: number) {
  const current = useConfigStore.getState().rolePermissions[role]
  const granted = current.includes(permission)
  useConfigStore.setState((s) => ({
    rolePermissions: {
      ...s.rolePermissions,
      [role]: granted ? current.filter((p) => p !== permission) : [...current, permission],
    },
  }))
  recordAudit({
    actor_id: actorId,
    action: 'role.permission_changed',
    entity: 'Role',
    entity_id: null,
    entity_label: role,
    changes: [{ field: permission, before: granted ? 'autorisé' : 'refusé', after: granted ? 'refusé' : 'autorisé' }],
  })
  toast(`${permission} ${granted ? 'retirée' : 'accordée'} au rôle ${role}`, granted ? 'alert' : 'ok')
}

export function updateSettings(change: Partial<PlatformSettings>, actorId: number, label: string) {
  const before = useConfigStore.getState().settings
  useConfigStore.setState((s) => ({ settings: { ...s.settings, ...change } }))
  recordAudit({
    actor_id: actorId,
    action: 'settings.updated',
    entity: 'PlatformSettings',
    entity_id: null,
    entity_label: label,
    changes: Object.entries(change).map(([field, value]) => ({
      field,
      before: JSON.stringify(before[field as keyof PlatformSettings]),
      after: JSON.stringify(value),
    })),
  })
  toast(`${label} : paramètre enregistré`)
}

export function saveTranslation(entity: string, entityId: number, locale: string, fields: Record<string, string>, actorId: number) {
  const entry = useConfigStore.getState().translations.find((t) => t.entity === entity && t.entity_id === entityId)
  if (!entry) return
  useConfigStore.setState((s) => ({
    translations: s.translations.map((t) =>
      t === entry ? { ...t, translations: { ...t.translations, [locale]: { ...t.translations[locale], ...fields } } } : t,
    ),
  }))
  recordAudit({
    actor_id: actorId,
    action: 'translation.updated',
    entity,
    entity_id: entityId,
    entity_label: `${entry.label} (${locale})`,
    changes: Object.entries(fields).map(([field, value]) => ({ field, before: entry.translations[locale]?.[field] ?? null, after: value })),
  })
  toast(`Traduction ${locale.toUpperCase()} enregistrée`)
}
