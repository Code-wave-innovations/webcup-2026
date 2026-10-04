import { isAxiosError } from 'axios'
import { currentLocale } from '../i18n/locale'
import { defineMessages, messagesFor } from '../i18n/messages'

/*
  Every API error comes back as { error: { code, message, details? } } (backend/src/middleware/error.ts).
  Validation errors (400 VALIDATION_ERROR) carry zod's `{ formErrors, fieldErrors }` in details.
  Server messages are in English: screens show `messageFor()` / `fieldErrors()`, in the visitor's language
  (always French in the back-office, see i18n/locale.ts).
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

const messages = defineMessages(
  {
    codes: {
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
      BOT_REJECTED: 'Soumission refusée. Rechargez la page et réessayez.',
      TURNSTILE_REQUIRED: 'Vérification anti-robot requise. Validez le défi, puis renvoyez le formulaire.',
      TURNSTILE_FAILED: 'La vérification anti-robot a échoué. Réessayez le défi.',
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
      ACCOUNT_DISABLED: 'Ce compte est suspendu par la mairie. Présentez-vous au guichet ou appelez la mairie pour le réactiver.',
      INVALID_RESET_CODE: 'Code incorrect ou expiré. Vérifiez-le, ou demandez un nouveau code à la mairie.',
      FACE_MISMATCH: 'Ce visage ne correspond pas au compte.',
      FACE_UNUSABLE: 'Aucun visage exploitable sur l’image.',
      FACE_NOT_ENROLLED: 'Aucun visage n’est encore associé à ce compte.',
      FACE_UNAVAILABLE: 'La reconnaissance faciale est indisponible pour le moment. Entrez avec votre code.',
      MAINTENANCE: 'La plateforme est en maintenance. Réessayez un peu plus tard.',
      INTERNAL_ERROR: 'Une erreur est survenue. Réessayez dans un instant.',
    },
    fallback: 'L’action n’a pas abouti. Réessayez.',
    field: {
      required: 'Ce champ est obligatoire.',
      endAfterStart: 'La fin doit être après le début.',
      future: 'Choisissez une heure à venir.',
      publicNote: 'Ce changement doit être expliqué à l’habitant : dites ce qu’il doit faire ou ce qui a été fait.',
      minLength: (n: string) => `Saisissez au moins ${n} caractères.`,
      maxLength: (n: string) => `${n} caractères au maximum.`,
      email: 'Saisissez une adresse e-mail valide, par exemple nom@exemple.fr.',
      min: (n: string) => `La valeur doit être au moins ${n}.`,
      max: (n: string) => `La valeur doit être au plus ${n}.`,
      number: 'Saisissez un nombre.',
      date: 'Saisissez une date valide.',
      invalid: 'Cette valeur n’est pas valide.',
    },
  },
  {
    codes: {
      NETWORK_ERROR: 'The server cannot be reached. Check your connection, then try again.',
      VALIDATION_ERROR: 'Some information is missing or invalid.',
      BAD_REQUEST: 'The request is incomplete or invalid.',
      UNAUTHORIZED: 'Your session has expired. Please sign in again.',
      INVALID_CREDENTIALS: 'Incorrect e-mail or password.',
      ACCOUNT_LOCKED: 'This account is temporarily locked after several attempts.',
      IP_BLOCKED: 'Too many attempts from this connection. Try again later.',
      FORBIDDEN: 'You do not have access to this action.',
      NOT_FOUND: 'Item not found.',
      CONFLICT: 'This item already exists.',
      SERVICE_UNAVAILABLE: 'This service is temporarily unavailable.',
      REGISTRATION_CLOSED: 'Registration is closed for now.',
      RATE_LIMITED: 'Too many requests in a short time. Wait a moment, then try again.',
      BOT_REJECTED: 'Submission refused. Reload the page and try again.',
      TURNSTILE_REQUIRED: 'Anti-robot check required. Complete the challenge, then send the form again.',
      TURNSTILE_FAILED: 'The anti-robot check failed. Try the challenge again.',
      SLOT_FULL: 'This slot has just been booked. Choose another one.',
      OVERLAPPING_APPOINTMENT: 'You already have an appointment at that time.',
      UPSTREAM_ERROR: 'The external service is not responding right now.',
      SESSION_REVOKED: 'This session was closed from another device. Please sign in again.',
      INVALID_TWO_FACTOR_CODE: 'Incorrect verification code.',
      INVALID_STEP_TOKEN: 'This step has expired. Start signing in again.',
      TWO_FACTOR_REQUIRED: 'The security policy requires two-step verification for your role.',
      TWO_FACTOR_ALREADY_ENABLED: 'Two-step verification is already on.',
      UNKNOWN_PASSKEY: 'This passkey is not registered on any account.',
      INVALID_PASSKEY: 'The passkey could not be verified.',
      ACCOUNT_DISABLED: 'This account has been suspended by the city hall. Visit the front desk or call the city hall to reactivate it.',
      INVALID_RESET_CODE: 'Incorrect or expired code. Check it, or ask the city hall for a new code.',
      FACE_MISMATCH: 'This face does not match the account.',
      FACE_UNUSABLE: 'No usable face in the image.',
      FACE_NOT_ENROLLED: 'No face is linked to this account yet.',
      FACE_UNAVAILABLE: 'Face recognition is unavailable right now. Enter with your code.',
      MAINTENANCE: 'The platform is under maintenance. Try again a little later.',
      INTERNAL_ERROR: 'Something went wrong. Try again in a moment.',
    },
    fallback: 'The action did not go through. Try again.',
    field: {
      required: 'This field is required.',
      endAfterStart: 'The end must be after the start.',
      future: 'Choose a time in the future.',
      publicNote: 'This change must be explained to the resident: say what they need to do or what was done.',
      minLength: (n) => `Enter at least ${n} characters.`,
      maxLength: (n) => `${n} characters at most.`,
      email: 'Enter a valid e-mail address, for example name@example.com.',
      min: (n) => `The value must be at least ${n}.`,
      max: (n) => `The value must be at most ${n}.`,
      number: 'Enter a number.',
      date: 'Enter a valid date.',
      invalid: 'This value is not valid.',
    },
  },
)

type ErrorCode = keyof (typeof messages)['fr']['codes']

const isKnownCode = (code: string, codes: object): code is ErrorCode => Object.prototype.hasOwnProperty.call(codes, code)

/** Codes whose server message is written for citizens (in French) and shown as is. */
const SERVER_WORDED = new Set(['MAINTENANCE', 'BOT_REJECTED', 'TURNSTILE_REQUIRED', 'TURNSTILE_FAILED', 'RATE_LIMITED'])

/** A sentence in the visitor's language for any error (French in the back-office), to show in a toast or at the top of a form. */
export function messageFor(error: unknown): string {
  const apiError = toApiError(error)
  const locale = currentLocale()
  const m = messagesFor(messages, locale)
  // the server words these in French: shown as is in French, replaced by our own sentence otherwise
  if (SERVER_WORDED.has(apiError.code) && locale === 'fr' && apiError.message) return apiError.message
  if (isKnownCode(apiError.code, m.codes)) return m.codes[apiError.code]
  return apiError.status >= 500 ? m.codes.INTERNAL_ERROR : m.fallback
}

/** zod's English messages, rewritten in the visitor's language so they can be shown next to the field (F42). */
function fieldMessage(message: string): string {
  const m = messagesFor(messages).field
  let match: RegExpMatchArray | null
  if (/^Required$/i.test(message)) return m.required
  if (/must be after starts_at/i.test(message)) return m.endAfterStart
  if (/must be in the future/i.test(message)) return m.future
  if (/public note is required/i.test(message)) return m.publicNote
  if ((match = message.match(/at least (\d+) character/i))) return m.minLength(match[1])
  if ((match = message.match(/at most (\d+) character/i))) return m.maxLength(match[1])
  if (/invalid email/i.test(message)) return m.email
  if ((match = message.match(/greater than or equal to (\d+)/i))) return m.min(match[1])
  if ((match = message.match(/less than or equal to (\d+)/i))) return m.max(match[1])
  if (/expected number/i.test(message)) return m.number
  if (/invalid date/i.test(message)) return m.date
  return m.invalid
}

/** Validation errors of the API as { field: message in the visitor's language }, for the matching form fields. */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!isApiError(error) || error.code !== 'VALIDATION_ERROR') return {}
  const details = error.details as { fieldErrors?: Record<string, string[] | undefined> } | undefined
  const result: Record<string, string> = {}
  for (const [field, messages] of Object.entries(details?.fieldErrors ?? {})) {
    if (messages?.length) result[field] = fieldMessage(messages[0])
  }
  return result
}
