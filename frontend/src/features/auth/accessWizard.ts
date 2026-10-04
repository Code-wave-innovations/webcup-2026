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
    role: 'resident',
  }
}

export function stepTitle(step: AccessStep): string {
  switch (step) {
    case 'identify':
      return 'Demande d’approche'
    case 'login':
      return 'Vérification d’identité'
    case 'recover':
      return 'Retrouver votre accès'
    case 'register-1':
      return 'Premier amarrage'
    case 'register-2':
      return 'Sceller votre accès'
    case 'register-3':
      return 'Empreinte de lumière'
  }
}

export function stepSubtitle(step: AccessStep, opts?: { face?: boolean }): string {
  switch (step) {
    case 'identify':
      return 'Nova ouvre le sas. Présentez votre signal citoyen.'
    case 'login':
      return opts?.face ? 'Regardez la caméra pour entrer.' : 'Le code d’accès confirme que c’est bien vous.'
    case 'recover':
      return 'Avec le code remis par la mairie, choisissez un nouveau code d’accès.'
    case 'register-1':
      return 'Identité et quartier — Terra Nova vous situe.'
    case 'register-2':
      return 'Choisissez un code que vous seul·e connaissez.'
    case 'register-3':
      return 'Enregistrez votre visage pour les prochaines entrées.'
  }
}
