import { isAxiosError } from 'axios'

/*
  Every API error comes back as { error: { code, message, details? } } (backend/src/middleware/error.ts).
  Validation errors (400 VALIDATION_ERROR) carry zod's `{ formErrors, fieldErrors }` in details.
  Server messages are in English: screens show `messageFor()` / `fieldErrors()`, which are in French.
*/

export class ApiError extends Error {
  /** HTTP status, 0 when the server could not be reached */
  readonly status: number
  /** stable code from the API (INVALID_CREDENTIALS, SERVICE_UNAVAILABLE…) */
  readonly code: string
  readonly details: unknown
  /** seconds, from the Retry-After header (F37 lockouts, rate limits) */
  readonly retryAfter: number | null

  constructor(status: number, code: string, message: string, details?: unknown, retryAfter: number | null = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
    this.retryAfter = retryAfter
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (isAxiosError(error)) {
    const response = error.response
    if (!response) return new ApiError(0, 'NETWORK_ERROR', error.message)
    const body = response.data as { error?: { code?: string; message?: string; details?: unknown } } | undefined
    // the header, or the same delay in the body (F37 lockouts) when a proxy hides the header
    const retryAfter = Number(
      response.headers?.['retry-after'] ?? (body?.error?.details as { retry_after_seconds?: number } | undefined)?.retry_after_seconds,
    )
    return new ApiError(
      response.status,
      body?.error?.code ?? `HTTP_${response.status}`,
      body?.error?.message ?? error.message,
      body?.error?.details,
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
    )
  }
  return new ApiError(0, 'UNKNOWN', error instanceof Error ? error.message : String(error))
}

const MESSAGES: Record<string, string> = {
  NETWORK_ERROR: 'Le serveur est injoignable. Vérifiez votre connexion, puis réessayez.',
  VALIDATION_ERROR: 'Certaines informations sont manquantes ou invalides.',
  BAD_REQUEST: 'La demande est incomplète ou invalide.',
  UNAUTHORIZED: 'Votre session a expiré. Reconnectez-vous.',
  INVALID_CREDENTIALS: 'E-mail ou mot de passe incorrect.',
  ACCOUNT_LOCKED: 'Ce compte est bloqué temporairement après plusieurs tentatives.',
  IP_BLOCKED: 'Trop de tentatives depuis cette connexion. Réessayez plus tard.',
  FORBIDDEN: 'Vous n’avez pas accès à cette action.',
  NOT_FOUND: 'Élément introuvable.',
  CONFLICT: 'Cet élément existe déjà.',
  SERVICE_UNAVAILABLE: 'Ce service est momentanément indisponible.',
  REGISTRATION_CLOSED: 'Les inscriptions sont fermées pour le moment.',
  RATE_LIMITED: 'Trop de demandes en peu de temps. Patientez un instant, puis réessayez.',
  SLOT_FULL: 'Ce créneau vient d’être réservé. Choisissez-en un autre.',
  OVERLAPPING_APPOINTMENT: 'Vous avez déjà un rendez-vous à ce moment-là.',
  UPSTREAM_ERROR: 'Le service externe ne répond pas pour le moment.',
  SESSION_REVOKED: 'Cette session a été fermée depuis un autre appareil. Reconnectez-vous.',
  INVALID_TWO_FACTOR_CODE: 'Code de vérification incorrect.',
  INVALID_STEP_TOKEN: 'Cette étape a expiré. Reprenez la connexion depuis le début.',
  TWO_FACTOR_REQUIRED: 'La politique de sécurité impose la double vérification à votre rôle.',
  TWO_FACTOR_ALREADY_ENABLED: 'La double vérification est déjà activée.',
  UNKNOWN_PASSKEY: 'Cette clé d’accès n’est enregistrée sur aucun compte.',
  INVALID_PASSKEY: 'La clé d’accès n’a pas pu être vérifiée.',
  INTERNAL_ERROR: 'Une erreur est survenue. Réessayez dans un instant.',
}

/** Codes whose server message is written for citizens (in French) and shown as is. */
const SERVER_WORDED = new Set(['MAINTENANCE'])

/** A French sentence for any error, to show in a toast or at the top of a form. */
export function messageFor(error: unknown): string {
  const apiError = toApiError(error)
  if (SERVER_WORDED.has(apiError.code)) return apiError.message
  return MESSAGES[apiError.code] ?? (apiError.status >= 500 ? MESSAGES.INTERNAL_ERROR : 'L’action n’a pas abouti. Réessayez.')
}

/** zod's English messages, rewritten in French so they can be shown next to the field (F42). */
function frenchFieldMessage(message: string): string {
  let match: RegExpMatchArray | null
  if (/^Required$/i.test(message)) return 'Ce champ est obligatoire.'
  if (/must be after starts_at/i.test(message)) return 'La fin doit être après le début.'
  if (/must be in the future/i.test(message)) return 'Choisissez une heure à venir.'
  if (/public note is required/i.test(message))
    return 'Ce changement doit être expliqué à l’habitant : dites ce qu’il doit faire ou ce qui a été fait.'
  if ((match = message.match(/at least (\d+) character/i))) return `Saisissez au moins ${match[1]} caractères.`
  if ((match = message.match(/at most (\d+) character/i))) return `${match[1]} caractères au maximum.`
  if (/invalid email/i.test(message)) return 'Saisissez une adresse e-mail valide, par exemple nom@exemple.fr.'
  if ((match = message.match(/greater than or equal to (\d+)/i))) return `La valeur doit être au moins ${match[1]}.`
  if ((match = message.match(/less than or equal to (\d+)/i))) return `La valeur doit être au plus ${match[1]}.`
  if (/expected number/i.test(message)) return 'Saisissez un nombre.'
  if (/invalid date/i.test(message)) return 'Saisissez une date valide.'
  return 'Cette valeur n’est pas valide.'
}

/** Validation errors of the API as { field: message in French }, for the matching form fields. */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!isApiError(error) || error.code !== 'VALIDATION_ERROR') return {}
  const details = error.details as { fieldErrors?: Record<string, string[] | undefined> } | undefined
  const result: Record<string, string> = {}
  for (const [field, messages] of Object.entries(details?.fieldErrors ?? {})) {
    if (messages?.length) result[field] = frenchFieldMessage(messages[0])
  }
  return result
}
