import type { SecurityEventKind } from '../../api/types'
import type { IconName } from '../ui/Icon'
import type { Tone } from './labels'

// F100: a short French line and a Tag tone for each security event the API can emit.

export interface SecurityEventLook {
  title: string
  tone: Tone
  icon: IconName
}

export const SECURITY_KINDS: { value: SecurityEventKind | ''; label: string }[] = [
  { value: '', label: 'Tous les types' },
  { value: 'login', label: 'Connexions' },
  { value: 'device', label: 'Appareils' },
  { value: 'factor', label: 'Protection' },
  { value: 'account', label: 'Compte' },
]

const LOOK: Record<string, SecurityEventLook> = {
  'login.locked': { title: 'Connexion refusée : compte verrouillé', tone: 'progress', icon: 'lock' },
  'login.ip_blocked': { title: 'Connexion refusée : adresse bloquée', tone: 'alert', icon: 'alert' },
  'login.disabled': { title: 'Connexion refusée : compte désactivé', tone: 'alert', icon: 'lock' },
  'user.login_unlocked': { title: 'Connexion débloquée', tone: 'ok', icon: 'unlock' },
  'security.new_device': { title: 'Nouvel appareil', tone: 'progress', icon: 'eye' },
  'security.device_forgotten': { title: 'Appareil oublié', tone: 'ok', icon: 'check' },
  'security.sessions_revoked': { title: 'Tous les appareils déconnectés', tone: 'progress', icon: 'power' },
  'security.2fa_enabled': { title: 'Double vérification activée', tone: 'ok', icon: 'shield' },
  'security.2fa_disabled': { title: 'Double vérification désactivée', tone: 'alert', icon: 'shield' },
  'security.2fa_reset': { title: 'Double vérification réinitialisée', tone: 'alert', icon: 'key' },
  'security.recovery_code_used': { title: 'Code de secours utilisé', tone: 'alert', icon: 'key' },
  'security.passkey_added': { title: 'Clé d’accès ajoutée', tone: 'ok', icon: 'key' },
  'security.passkey_revoked': { title: 'Clé d’accès révoquée', tone: 'progress', icon: 'key' },
  'security.password_changed': { title: 'Mot de passe changé', tone: 'progress', icon: 'lock' },
  'security.password_reset': { title: 'Mot de passe réinitialisé', tone: 'alert', icon: 'lock' },
  'security.face_enrolled': { title: 'Visage enregistré', tone: 'progress', icon: 'user' },
}

export function securityEventLook(type: string): SecurityEventLook {
  return LOOK[type] ?? { title: type, tone: 'neutral', icon: 'info' }
}
