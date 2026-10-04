import type { ActiveAlert, AlertSeverity } from '../../api/types'
import type { IconName } from '../../ui/Icon'
import { recommendationsOf, stepsOf } from '../../lib/alertText'

export { recommendationsOf, stepsOf }

/** D18: the level is always written and drawn, never told by the colour alone. */
export const SEVERITY: Record<AlertSeverity, { label: string; rank: number }> = {
  CRITICAL: { label: 'Alerte critique', rank: 3 },
  WARNING: { label: 'Vigilance', rank: 2 },
  INFO: { label: 'Information', rank: 1 },
}

export const SEVERITY_ICON: Record<AlertSeverity, IconName> = { CRITICAL: 'siren', WARNING: 'alert', INFO: 'info' }

/** What concerns me first, then the most serious, then the most recent. */
export function sortAlerts<T extends Pick<ActiveAlert, 'concerns_me' | 'severity' | 'starts_at'>>(alerts: readonly T[]): T[] {
  return [...alerts].sort(
    (a, b) =>
      Number(b.concerns_me) - Number(a.concerns_me) ||
      SEVERITY[b.severity].rank - SEVERITY[a.severity].rank ||
      Date.parse(b.starts_at) - Date.parse(a.starts_at),
  )
}

/** F29 / F31: who the alert speaks to, in words. */
export function zoneLabel(alert: Pick<ActiveAlert, 'audience' | 'districts'>): string {
  const names = alert.districts.map((d) => d.name).join(', ')
  if (alert.audience === 'DISTRICTS') return names || 'Quartiers ciblés'
  if (alert.audience === 'VULNERABLE') return names ? `Personnes vulnérables · ${names}` : 'Personnes vulnérables'
  return 'Toute la ville'
}

/** The alerts that must take over the screen: they concern me and I have not acknowledged them. */
export function pendingTransmissions<T extends Pick<ActiveAlert, 'id' | 'concerns_me'>>(sorted: readonly T[], acknowledged: readonly number[]): T[] {
  return sorted.filter((a) => a.concerns_me && !acknowledged.includes(a.id))
}

const TIME = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })
const DAY = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

/** "14:32", or "lundi 5 octobre, 14:32" when it is not today */
export function formatWhen(iso: string, now: number): string {
  const date = new Date(iso)
  const sameDay = new Date(now).toDateString() === date.toDateString()
  return sameDay ? TIME.format(date) : `${DAY.format(date)}, ${TIME.format(date)}`
}

/** "Depuis 14:32 · jusqu'à 20:00" */
export function periodOf(alert: Pick<ActiveAlert, 'starts_at' | 'ends_at'>, now: number): string {
  const end = alert.ends_at ? `jusqu'à ${formatWhen(alert.ends_at, now)}` : "jusqu'à nouvel ordre"
  return `Depuis ${formatWhen(alert.starts_at, now)} · ${end}`
}

/* ─── what this browser remembers (per viewer, not shared) ──────────────── */

const STORAGE_KEY = 'nova-alerts'

export interface AlertMemory {
  /** read the transmission and pressed « J'ai compris » */
  acknowledged: number[]
  /** folded away from the banner */
  dismissed: number[]
}

export function readMemory(): AlertMemory {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<AlertMemory>
    return { acknowledged: raw.acknowledged ?? [], dismissed: raw.dismissed ?? [] }
  } catch {
    return { acknowledged: [], dismissed: [] }
  }
}

/** Keeps only the alerts still in force, so the list never grows. */
export function writeMemory(memory: AlertMemory, activeIds: readonly number[]): void {
  const keep = (ids: number[]) => ids.filter((id) => activeIds.includes(id))
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ acknowledged: keep(memory.acknowledged), dismissed: keep(memory.dismissed) }))
  } catch {
    // private window or blocked storage: the alerts simply show again on the next visit
  }
}
