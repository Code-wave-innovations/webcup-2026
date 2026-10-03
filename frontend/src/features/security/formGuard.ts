/** Fields sent with public form POSTs so the backend can reject bots. */
export type FormGuardPayload = {
  website: string
  form_started_at: number
  turnstile_token?: string
}

/** Empty honeypot + open timestamp; optional Turnstile token after a soft challenge. */
export function formGuardPayload(startedAt: number, turnstileToken?: string | null): FormGuardPayload {
  return {
    website: '',
    form_started_at: startedAt,
    ...(turnstileToken ? { turnstile_token: turnstileToken } : {}),
  }
}

export const turnstileSiteKey = (): string | undefined => {
  const key = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim()
  return key || undefined
}
