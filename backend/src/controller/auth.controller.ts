import type { Request, Response } from "express";
import { z } from "zod";
import userModel from "../model/user.model";
import { HttpError, forbidden } from "../lib/errors";
import { hashPassword, verifyPassword } from "../lib/password";
import {
  MAX_ACCOUNT_FAILURES,
  UNKNOWN_IP,
  checkLoginAllowed,
  failuresSinceLastLogin,
  recordAttempt,
} from "../lib/loginGuard";
import { notifyUser } from "../lib/notify";
import { clientIp } from "../lib/rateLimit";
import { zBool, zId, zLocale } from "../lib/validation";
import { generateToken } from "../services/services";

export const zEmail = z.string().trim().toLowerCase().email().max(191);
export const zPassword = z.string().min(8, "Password must contain at least 8 characters").max(128);

// D01: self-registration always creates a CITIZEN; staff accounts are created by an admin.
export const registerSchema = z.object({
  email: zEmail,
  password: zPassword,
  name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().min(1).max(100),
  phone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(191).optional(),
  district_id: zId.optional(),
  locale: zLocale.optional(),
  is_vulnerable: zBool.optional(),
});

const loginSchema = z.object({
  email: zEmail,
  password: z.string().min(1),
});

const authController = {
  register: async (req: Request, res: Response) => {
    const { password, ...input } = registerSchema.parse(req.body);
    const user = await userModel.create({
      ...input,
      password_hash: await hashPassword(password),
      role: "CITIZEN",
    });
    res.status(201).json({ token: generateToken(user.id, user.email, user.role), user });
  },

  // D03 login, F37 brute-force protection (see lib/loginGuard.ts)
  login: async (req: Request, res: Response) => {
    const { email, password } = loginSchema.parse(req.body);
    const ip = clientIp(req) ?? UNKNOWN_IP;
    const userAgent = req.get("user-agent");

    const guard = await checkLoginAllowed(email, ip);
    if (!guard.allowed) {
      await recordAttempt({ email, ip, userAgent, success: false, reason: guard.code === "IP_BLOCKED" ? "IP_BLOCKED" : "LOCKED" });
      const minutes = Math.ceil(guard.retryAfterSeconds / 60);
      res.set("Retry-After", String(guard.retryAfterSeconds));
      throw new HttpError(
        429,
        guard.code,
        `Trop de tentatives de connexion. Pour votre sécurité, réessayez dans ${minutes} minute(s).`,
        { retry_after_seconds: guard.retryAfterSeconds }
      );
    }

    const account = await userModel.getByEmailWithPassword(email);
    const valid = await verifyPassword(password, account?.password_hash);
    if (!account || !valid) {
      await recordAttempt({ email, ip, userAgent, success: false, reason: "INVALID_CREDENTIALS", userId: account?.id });
      const remaining = Math.max(0, MAX_ACCOUNT_FAILURES - guard.failures - 1);
      if (remaining === 0 && account) {
        await notifyUser(account.id, {
          type: "SECURITY",
          title: "Connexion temporairement bloquée sur votre compte",
          body: "Plusieurs mots de passe erronés ont été saisis. Si ce n'était pas vous, changez votre mot de passe dès votre prochaine connexion.",
          data: { ip },
        });
      }
      throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid email or password", { remaining_attempts: remaining });
    }
    if (!account.is_active) {
      await recordAttempt({ email, ip, userAgent, success: false, reason: "DISABLED", userId: account.id });
      throw forbidden("This account has been disabled");
    }

    const failedSinceLastLogin = await failuresSinceLastLogin(email);
    await recordAttempt({ email, ip, userAgent, success: true, reason: "OK", userId: account.id });
    const user = await userModel.update(account.id, { last_login_at: new Date() });
    res.json({
      token: generateToken(user.id, user.email, user.role),
      user,
      // Shown to the user so an attack on their account is visible
      security: { failed_attempts_since_last_login: failedSinceLastLogin },
    });
  },
};

export default authController;
