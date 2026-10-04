import { HttpError } from "./errors";

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export const turnstileConfigured = (): boolean => Boolean(process.env.TURNSTILE_SECRET_KEY?.trim());

type SiteverifyResponse = {
  success?: boolean;
  "error-codes"?: string[];
};

/**
 * Verify a Turnstile token with Cloudflare Siteverify.
 * When TURNSTILE_SECRET_KEY is unset, verification is skipped (local/dev without Cloudflare).
 */
export const verifyTurnstile = async (
  token: string | undefined,
  remoteip: string | undefined
): Promise<void> => {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return;

  if (!token?.trim()) {
    throw new HttpError(
      403,
      "TURNSTILE_REQUIRED",
      "Vérification anti-robot requise. Validez le défi, puis renvoyez le formulaire."
    );
  }

  let data: SiteverifyResponse;
  try {
    const body = new URLSearchParams();
    body.set("secret", secret);
    body.set("response", token.trim());
    if (remoteip) body.set("remoteip", remoteip);

    const response = await fetch(SITEVERIFY, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    data = (await response.json()) as SiteverifyResponse;
  } catch {
    throw new HttpError(
      403,
      "TURNSTILE_FAILED",
      "La vérification anti-robot a échoué. Réessayez dans un instant."
    );
  }

  if (!data.success) {
    throw new HttpError(
      403,
      "TURNSTILE_FAILED",
      "La vérification anti-robot a échoué. Réessayez le défi, puis renvoyez le formulaire."
    );
  }
};

/**
 * When the submission looks suspicious and Turnstile is configured, require a valid token.
 * Tokens already present are always verified (even if not yet over the soft threshold).
 */
export const assertTurnstileIfNeeded = async (opts: {
  suspect: boolean;
  token: string | undefined;
  ip: string | undefined;
}): Promise<void> => {
  if (!turnstileConfigured()) return;
  if (!opts.suspect && !opts.token?.trim()) return;
  await verifyTurnstile(opts.token, opts.ip);
};
