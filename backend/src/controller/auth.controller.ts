import type { Request, Response } from "express";
import type { User } from "@prisma/client";
import { z } from "zod";
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type AuthenticationResponseJSON,
} from "@simplewebauthn/server";
import prisma from "../lib/prisma";
import { auditAs } from "../lib/audit";
import { recordDevice } from "../lib/devices";
import { readStepToken, sessionToken, stepToken } from "../lib/tokens";
import { checkCode, consumeRecoveryCode, newRecoveryCodes, newSecret, setupPayload } from "../lib/twoFactor";
import { expectedOrigins, rpId } from "../lib/webauthn";
import userModel from "../model/user.model";
import { HttpError, forbidden, notFound } from "../lib/errors";
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
import { getSetting } from "../lib/settings";
import { saveUpload } from "../lib/upload";
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

const byEmailQuerySchema = z.object({
  email: zEmail,
});

const assertLoginAllowed = async (req: Request, res: Response, email: string) => {
  const ip = clientIp(req) ?? UNKNOWN_IP;
  const userAgent = req.get("user-agent");
  const guard = await checkLoginAllowed(email, ip);
  if (!guard.allowed) {
    await recordAttempt({
      email,
      ip,
      userAgent,
      success: false,
      reason: guard.code === "IP_BLOCKED" ? "IP_BLOCKED" : "LOCKED",
    });
    const minutes = Math.ceil(guard.retryAfterSeconds / 60);
    res.set("Retry-After", String(guard.retryAfterSeconds));
    throw new HttpError(
      429,
      guard.code,
      `Trop de tentatives de connexion. Pour votre sécurité, réessayez dans ${minutes} minute(s).`,
      { retry_after_seconds: guard.retryAfterSeconds }
    );
  }
  return { ip, userAgent, guard };
};

type LoginMethod = "password" | "face" | "two_factor" | "passkey";

const actorOf = (account: Pick<User, "id" | "role" | "name" | "last_name">) => ({
  id: account.id,
  role: account.role,
  name: account.name,
  last_name: account.last_name,
});

const invalidStep = () => new HttpError(401, "INVALID_STEP_TOKEN", "This step has expired, sign in again");

/**
 * D03 / F53 / F54: how every sign-in ends. A password (or a face) is not enough for an account
 * with a second factor: a 5-minute challenge is returned instead of a session. A role that the
 * policy requires to use one, and that has none yet, must set it up first. A passkey already is
 * a second factor (user verification) and satisfies the policy.
 */
const completeLogin = async (req: Request, res: Response, account: User, method: LoginMethod, extra: Record<string, unknown> = {}) => {
  const ip = clientIp(req) ?? UNKNOWN_IP;
  const userAgent = req.get("user-agent");
  if (!account.is_active) {
    await recordAttempt({ email: account.email, ip, userAgent, success: false, reason: "DISABLED", userId: account.id });
    throw forbidden("This account has been disabled");
  }

  if (method === "password" || method === "face") {
    if (account.two_factor_enabled_at) {
      res.json({ two_factor_required: true, challenge_token: stepToken("2fa", { id: account.id }, "5m") });
      return;
    }
    const required = await getSetting("two_factor_required_roles");
    if (required.includes(account.role)) {
      res.json({ two_factor_setup_required: true, setup_token: stepToken("2fa-setup", { id: account.id }, "15m") });
      return;
    }
  }

  const failedSinceLastLogin = await failuresSinceLastLogin(account.email);
  await recordAttempt({ email: account.email, ip, userAgent, success: true, reason: method === "passkey" ? "PASSKEY" : "OK", userId: account.id });
  const user = await userModel.update(account.id, { last_login_at: new Date() });
  const { device, isNew } = await recordDevice(req, account.id);

  const actor = actorOf(account);
  if (isNew) {
    await auditAs(actor, req, { action: "security.new_device", entity: "User", entityId: account.id, label: `${account.name} ${account.last_name}`, metadata: { device: device.label } });
  }
  if (account.role !== "CITIZEN") {
    await auditAs(actor, req, { action: "auth.staff_login", entity: "User", entityId: account.id, label: `${account.name} ${account.last_name}`, metadata: { method, device: device.label } });
  }

  res.json({
    token: sessionToken(account),
    user,
    security: { failed_attempts_since_last_login: failedSinceLastLogin, new_device: isNew, device_id: device.id },
    ...extra,
  });
};

const codeSchema = z.object({
  challenge_token: z.string().min(10),
  code: z.string().trim().max(12).optional(),
  recovery_code: z.string().trim().max(20).optional(),
});

const setupSchema = z.object({ setup_token: z.string().min(10) });
const activateSchema = setupSchema.extend({ code: z.string().trim().min(6).max(12) });
const passkeyOptionsSchema = z.object({ email: zEmail.optional() });
const passkeyVerifySchema = z.object({ challenge_token: z.string().min(10), response: z.record(z.unknown()) });

const authController = {
  register: async (req: Request, res: Response) => {
    const { password, ...input } = registerSchema.parse(req.body);
    // D08: admins can close registrations (PlatformSetting registration_open)
    if (!(await getSetting("registration_open"))) {
      throw new HttpError(403, "REGISTRATION_CLOSED", "Registrations are currently closed");
    }
    const profile = await saveUpload(req, "profile", "profile");
    const user = await userModel.create({
      ...input,
      profile,
      password_hash: await hashPassword(password),
      role: "CITIZEN",
    });
    res.status(201).json({ token: generateToken(user.id, user.email, user.role), user });
  },

  // D03 login, F37 brute-force protection (see lib/loginGuard.ts)
  login: async (req: Request, res: Response) => {
    const { email, password } = loginSchema.parse(req.body);
    const { ip, userAgent, guard } = await assertLoginAllowed(req, res, email);

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
    await completeLogin(req, res, account, "password");
  },

  // F53: second step of a sign-in with a code from the app, or a recovery code (single use)
  verifyTwoFactor: async (req: Request, res: Response) => {
    const { challenge_token, code, recovery_code } = codeSchema.parse(req.body);
    const step = readStepToken<{ id: number }>(challenge_token, "2fa");
    if (!step) throw invalidStep();
    const account = await prisma.user.findUnique({ where: { id: step.id } });
    if (!account || !account.two_factor_enabled_at) throw invalidStep();
    const { ip, userAgent, guard } = await assertLoginAllowed(req, res, account.email);

    const valid = recovery_code
      ? await consumeRecoveryCode(account.id, recovery_code)
      : checkCode(account.two_factor_secret, code ?? "");
    if (!valid) {
      // A wrong code counts like a wrong password (F37)
      await recordAttempt({ email: account.email, ip, userAgent, success: false, reason: "INVALID_CREDENTIALS", userId: account.id });
      const remaining = Math.max(0, MAX_ACCOUNT_FAILURES - guard.failures - 1);
      throw new HttpError(401, "INVALID_TWO_FACTOR_CODE", "Invalid verification code", { remaining_attempts: remaining });
    }
    if (recovery_code) {
      await auditAs(actorOf(account), req, { action: "security.recovery_code_used", entity: "User", entityId: account.id, label: `${account.name} ${account.last_name}` });
    }
    await completeLogin(req, res, account, "two_factor");
  },

  // F53: the policy requires a second factor that the account does not have yet
  setupTwoFactor: async (req: Request, res: Response) => {
    const { setup_token } = setupSchema.parse(req.body);
    const step = readStepToken<{ id: number }>(setup_token, "2fa-setup");
    if (!step) throw invalidStep();
    const account = await prisma.user.findUnique({ where: { id: step.id } });
    if (!account || account.two_factor_enabled_at) throw invalidStep();
    const secret = newSecret();
    await prisma.user.update({ where: { id: account.id }, data: { two_factor_secret: secret } });
    res.json(await setupPayload(account.email, secret));
  },

  activateTwoFactor: async (req: Request, res: Response) => {
    const { setup_token, code } = activateSchema.parse(req.body);
    const step = readStepToken<{ id: number }>(setup_token, "2fa-setup");
    if (!step) throw invalidStep();
    const account = await prisma.user.findUnique({ where: { id: step.id } });
    if (!account || account.two_factor_enabled_at) throw invalidStep();
    if (!checkCode(account.two_factor_secret, code)) {
      throw new HttpError(400, "INVALID_TWO_FACTOR_CODE", "Invalid verification code");
    }
    const enabled = await prisma.user.update({ where: { id: account.id }, data: { two_factor_enabled_at: new Date() } });
    const recovery_codes = await newRecoveryCodes(account.id);
    await auditAs(actorOf(account), req, { action: "security.2fa_enabled", entity: "User", entityId: account.id, label: `${account.name} ${account.last_name}`, metadata: { during: "login" } });
    // the session opens right away, with the recovery codes shown once
    await completeLogin(req, res, enabled, "two_factor", { recovery_codes });
  },

  // D02: a passkey sign-in starts with a challenge, for an e-mail or for any passkey of this site
  passkeyOptions: async (req: Request, res: Response) => {
    const { email } = passkeyOptionsSchema.parse(req.body ?? {});
    const passkeys = email
      ? await prisma.passkey.findMany({ where: { user: { email } }, select: { credential_id: true, transports: true } })
      : [];
    const options = await generateAuthenticationOptions({
      rpID: rpId(),
      userVerification: "required",
      allowCredentials: passkeys.map((p) => ({ id: p.credential_id, transports: p.transports?.split(",") })),
    });
    res.json({ options, challenge_token: stepToken("webauthn-login", { challenge: options.challenge }, "5m") });
  },

  passkeyVerify: async (req: Request, res: Response) => {
    const { challenge_token, response } = passkeyVerifySchema.parse(req.body);
    const step = readStepToken<{ challenge: string }>(challenge_token, "webauthn-login");
    if (!step) throw invalidStep();
    const answer = response as unknown as AuthenticationResponseJSON;
    const passkey = await prisma.passkey.findUnique({ where: { credential_id: answer.id }, include: { user: true } });
    if (!passkey) throw new HttpError(401, "UNKNOWN_PASSKEY", "This passkey is not registered");
    await assertLoginAllowed(req, res, passkey.user.email);

    let verified = false;
    let newCounter = passkey.counter;
    try {
      const result = await verifyAuthenticationResponse({
        response: answer,
        expectedChallenge: step.challenge,
        expectedOrigin: expectedOrigins(req),
        expectedRPID: rpId(),
        requireUserVerification: true,
        credential: {
          id: passkey.credential_id,
          publicKey: new Uint8Array(passkey.public_key),
          counter: passkey.counter,
          transports: passkey.transports?.split(","),
        },
      });
      verified = result.verified;
      newCounter = result.authenticationInfo.newCounter;
    } catch {
      verified = false;
    }
    if (!verified) {
      await recordAttempt({ email: passkey.user.email, ip: clientIp(req) ?? UNKNOWN_IP, userAgent: req.get("user-agent"), success: false, reason: "INVALID_CREDENTIALS", userId: passkey.user_id });
      throw new HttpError(401, "INVALID_PASSKEY", "The passkey could not be verified");
    }
    await prisma.passkey.update({ where: { id: passkey.id }, data: { counter: newCounter, last_used_at: new Date() } });
    await completeLogin(req, res, passkey.user, "passkey");
  },

  // Existence check for the airlock (no session). Prefer this over getByEmail for routing.
  exists: async (req: Request, res: Response) => {
    const { email } = byEmailQuerySchema.parse(req.query);
    res.json({ exists: await userModel.existsByEmail(email) });
  },

  // Passwordless session by email (e.g. after frontend face identify). Same payload as login.
  getByEmail: async (req: Request, res: Response) => {
    const { email } = byEmailQuerySchema.parse(req.query);
    await assertLoginAllowed(req, res, email);
    const account = await userModel.getByEmailWithPassword(email);
    if (!account) throw notFound("User not found");
    // a face is not a second factor: an account with one still gets the code step
    await completeLogin(req, res, account, "face");
  },
};

export default authController;
