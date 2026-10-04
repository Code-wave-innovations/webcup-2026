import { defineMessages, messagesFor, type Locale } from '../../i18n'
import { accountExists, isEmail, resolveAuthEmail, type Session } from './authService'
import { DEMO_ACCOUNTS } from './demoAccounts'

export type AccessStep = 'identify' | 'login' | 'recover' | 'register-1' | 'register-2' | 'register-3'

export function normalizeIdentifier(value: string): string {
  return value.trim().toLowerCase()
}

/** Empty → 'empty'; looks like email but invalid → 'email'; else ok */
export function validateIdentifier(value: string): 'ok' | 'empty' | 'email' {
  const trimmed = value.trim()
  if (!trimmed) return 'empty'
  if (trimmed.includes('@') && !isEmail(trimmed)) return 'email'
  return 'ok'
}

/** Known demo account (email or short id) → 'login'; else 'register' */
export function lookupAccount(identifier: string): 'login' | 'register' {
  const key = normalizeIdentifier(identifier)
  const known = Object.values(DEMO_ACCOUNTS).some((a) => a.id === key || a.email === key)
  return known ? 'login' : 'register'
}

/** Demo first, then live `GET /api/auth/exists`. */
export async function resolveAccessRoute(identifier: string): Promise<'login' | 'register'> {
  if (lookupAccount(identifier) === 'login') return 'login'
  return (await accountExists(resolveAuthEmail(identifier))) ? 'login' : 'register'
}

export function validateRegisterNames(name: string, lastName: string): 'ok' | 'missing' {
  const n = name.trim()
  const l = lastName.trim()
  if (!n || !l || n.length > 100 || l.length > 100) return 'missing'
  return 'ok'
}

/** Names + required district id (positive integer). */
export function validateRegisterIdentity(
  name: string,
  lastName: string,
  districtId: number | null,
): 'ok' | 'missing' | 'district' {
  if (validateRegisterNames(name, lastName) === 'missing') return 'missing'
  if (districtId == null || !Number.isInteger(districtId) || districtId < 1) return 'district'
  return 'ok'
}

export function validateRegisterSecrets(password: string, confirm: string): 'ok' | 'short' | 'mismatch' {
  if (password.length < 8) return 'short'
  if (password !== confirm) return 'mismatch'
  return 'ok'
}

export function sessionFromRegister(identifier: string, name: string): Session {
  const key = normalizeIdentifier(identifier)
  const accountId = key.includes('@') ? key.slice(0, key.indexOf('@')) || 'citizen' : key || 'citizen'
  return {
    accountId,
    name: name.trim(),
    roleLabel: 'Habitante',
    roleKey: 'resident',
    role: 'resident',
  }
}

const messages = defineMessages(
  {
    title: {
      identify: 'Demande d’approche',
      login: 'Vérification d’identité',
      recover: 'Retrouver votre accès',
      'register-1': 'Premier amarrage',
      'register-2': 'Sceller votre accès',
      'register-3': 'Empreinte de lumière',
    },
    subtitle: {
      identify: 'Nova ouvre le sas. Présentez votre signal citoyen.',
      login: 'Le code d’accès confirme que c’est bien vous.',
      loginFace: 'Regardez la caméra pour entrer.',
      recover: 'Avec le code remis par la mairie, choisissez un nouveau code d’accès.',
      'register-1': 'Identité et quartier — Terra Nova vous situe.',
      'register-2': 'Choisissez un code que vous seul·e connaissez.',
      'register-3': 'Enregistrez votre visage pour les prochaines entrées.',
    },
  },
  {
    title: {
      identify: 'Approach request',
      login: 'Identity check',
      recover: 'Recover your access',
      'register-1': 'First docking',
      'register-2': 'Seal your access',
      'register-3': 'Light print',
    },
    subtitle: {
      identify: 'Nova opens the airlock. Show your citizen signal.',
      login: 'Your access code confirms it is really you.',
      loginFace: 'Look at the camera to come in.',
      recover: 'With the code the city hall gave you, choose a new access code.',
      'register-1': 'Identity and district — Terra Nova places you.',
      'register-2': 'Choose a code that only you know.',
      'register-3': 'Record your face for your next arrivals.',
    },
  },
)

/** Title of an access step, in the given language (the visitor's by default). */
export function stepTitle(step: AccessStep, locale?: Locale): string {
  return messagesFor(messages, locale).title[step]
}

export function stepSubtitle(step: AccessStep, opts?: { face?: boolean }, locale?: Locale): string {
  const subtitle = messagesFor(messages, locale).subtitle
  return step === 'login' && opts?.face ? subtitle.loginFace : subtitle[step]
}
