import crypto from "crypto";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import prisma from "./prisma";
import { hashPassword, verifyPassword } from "./password";

// F53: time-based codes (TOTP, any authenticator app) and single-use recovery codes.
// One period of clock drift is accepted either way.
authenticator.options = { window: 1 };

const ISSUER = "Nova Terra";
const RECOVERY_CODES = 8;

export const newSecret = () => authenticator.generateSecret();

/** What an authenticator app scans, plus the key to type by hand. */
export async function setupPayload(email: string, secret: string) {
  const otpauth_url = authenticator.keyuri(email, ISSUER, secret);
  return { otpauth_url, qr_data_url: await QRCode.toDataURL(otpauth_url, { margin: 1, width: 220 }), secret };
}

export const checkCode = (secret: string | null, code: string) =>
  Boolean(secret) && /^\d{6}$/.test(code.replace(/\s/g, "")) && authenticator.check(code.replace(/\s/g, ""), secret!);

/** Replaces the recovery codes of an account; the plain codes are returned once. */
export async function newRecoveryCodes(userId: number) {
  const codes = Array.from({ length: RECOVERY_CODES }, () => {
    const raw = crypto.randomBytes(5).toString("hex").toUpperCase();
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
  const hashes = await Promise.all(codes.map((code) => hashPassword(code)));
  await prisma.$transaction([
    prisma.twoFactorRecoveryCode.deleteMany({ where: { user_id: userId } }),
    prisma.twoFactorRecoveryCode.createMany({ data: hashes.map((code_hash) => ({ user_id: userId, code_hash })) }),
  ]);
  return codes;
}

/** Uses a recovery code: true once, then never again. */
export async function consumeRecoveryCode(userId: number, code: string) {
  const normalized = code.trim().toUpperCase();
  const unused = await prisma.twoFactorRecoveryCode.findMany({ where: { user_id: userId, used_at: null } });
  for (const row of unused) {
    if (await verifyPassword(normalized, row.code_hash)) {
      const { count } = await prisma.twoFactorRecoveryCode.updateMany({ where: { id: row.id, used_at: null }, data: { used_at: new Date() } });
      return count === 1;
    }
  }
  return false;
}

export const remainingRecoveryCodes = (userId: number) => prisma.twoFactorRecoveryCode.count({ where: { user_id: userId, used_at: null } });
