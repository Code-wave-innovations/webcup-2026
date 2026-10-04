import crypto from "crypto";
import { hashPassword, verifyPassword } from "./password";

// F34: the code an agent hands over (at the counter or on the phone) once the person's identity is
// checked. The person types it in the airlock with a new password: the agent never knows the password.
// 8 characters from an alphabet without look-alikes (0/O, 1/I/L): ~8.5e11 combinations, and every
// wrong try counts toward the F37 login lock, so it cannot be guessed. Kept as a hash, single use.

export const RESET_CODE_MINUTES = 30;
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** "K7QM-3XWD" */
export const newResetCode = () => {
  const chars = Array.from({ length: 8 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
};

/** What the person typed, whatever the case, spaces or dash */
export const normalizeResetCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, "");

export const hashResetCode = (code: string) => hashPassword(normalizeResetCode(code));

export const resetCodeMatches = (code: string, hash: string | null | undefined) => verifyPassword(normalizeResetCode(code), hash);
