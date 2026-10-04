import { generateToken, jwtSecret } from "../services/services";

// jsonwebtoken ships no types here; services.ts requires it the same way
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jwt: {
  sign: (payload: object, secret: string, options: { expiresIn: string }) => string;
  verify: (token: string, secret: string) => unknown;
} = require("jsonwebtoken");

/*
  Sessions and single-use step tokens share the JWT secret, so they are told apart by `purpose`:
  a session token has none and carries the account's token_version (`tv`), which `authenticate`
  compares to sign out every device at once. A step token (2FA challenge, 2FA setup, passkey
  ceremony) is short-lived and is refused by `authenticate`.
*/

export type StepPurpose = "2fa" | "2fa-setup" | "webauthn-register" | "webauthn-login";

export const sessionToken = (user: { id: number; email: string; role: string; token_version: number }) =>
  generateToken(user.id, user.email, user.role, user.token_version);

export const stepToken = (purpose: StepPurpose, payload: Record<string, unknown>, expiresIn: `${number}m`) =>
  jwt.sign({ ...payload, purpose }, jwtSecret(), { expiresIn });

/** The payload of a step token of this purpose, or null when it is invalid, expired or of another kind. */
export function readStepToken<T extends Record<string, unknown>>(token: string, purpose: StepPurpose): (T & { purpose: StepPurpose }) | null {
  try {
    const payload = jwt.verify(token, jwtSecret()) as T & { purpose?: StepPurpose };
    return payload.purpose === purpose ? (payload as T & { purpose: StepPurpose }) : null;
  } catch {
    return null;
  }
}
