import type { Request, Response } from "express";
import { z } from "zod";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import prisma from "../lib/prisma";
import { audit } from "../lib/audit";
import { deviceHash } from "../lib/devices";
import { HttpError, badRequest, notFound } from "../lib/errors";
import { verifyPassword } from "../lib/password";
import { enrollFace } from "../lib/faceGateway";
import { getSetting } from "../lib/settings";
import { readStepToken, sessionToken, stepToken } from "../lib/tokens";
import { checkCode, newRecoveryCodes, newSecret, remainingRecoveryCodes, setupPayload } from "../lib/twoFactor";
import { parseId } from "../lib/validation";
import { RP_NAME, expectedOrigins, rpId } from "../lib/webauthn";

// BO-05: the signed-in person's own sign-in security (« Mon compte »): devices (F54),
// sessions, second factor (F53) and passkeys (D02). Every change is audited.

const codeSchema = z.object({ code: z.string().trim().min(6).max(12) });
const disableSchema = codeSchema.extend({ password: z.string().min(1) });
const passkeyVerifySchema = z.object({
  challenge_token: z.string().min(10),
  response: z.record(z.unknown()),
  label: z.string().trim().min(1).max(120),
});

const me = (req: Request) => req.user!;
const myName = (req: Request) => `${req.user!.name} ${req.user!.last_name}`;
const target = (req: Request) => ({ entity: "User", entityId: req.user!.id, label: myName(req) });

const loadMe = async (req: Request) => {
  const user = await prisma.user.findUnique({ where: { id: me(req).id } });
  if (!user) throw notFound();
  return user;
};

export const passkeyList = (userId: number) =>
  prisma.passkey.findMany({
    where: { user_id: userId },
    orderBy: { created_at: "desc" },
    select: { id: true, label: true, created_at: true, last_used_at: true },
  });

export const deviceList = (userId: number) =>
  prisma.userDevice.findMany({
    where: { user_id: userId },
    orderBy: { last_seen: "desc" },
    select: { id: true, label: true, first_seen: true, last_seen: true, last_ip: true, device_hash: true },
  });

const meSecurityController = {
  // D03 / F34: links the signed-in person's face to their own account, never to anybody else's
  enrollFace: async (req: Request, res: Response) => {
    const frames = Object.entries(req.files ?? {})
      .filter(([field]) => /^img\d*$/.test(field))
      .flatMap(([, file]) => (Array.isArray(file) ? file : [file]))
      .slice(0, 10);
    if (frames.length === 0) throw badRequest("Send the pictures in img0, img1…");
    const user = req.user!;
    const result = await enrollFace(user.email, frames);
    await audit(req, { action: "security.face_enrolled", entity: "User", entityId: user.id, label: `${user.name} ${user.last_name}`, metadata: { frames: frames.length, committed: result.committed } });
    res.json(result);
  },

  // What « Mon compte » shows: second factor, passkeys, devices (the current one marked)
  overview: async (req: Request, res: Response) => {
    const user = await loadMe(req);
    const [required, recovery, passkeys, devices] = await Promise.all([
      getSetting("two_factor_required_roles"),
      remainingRecoveryCodes(user.id),
      passkeyList(user.id),
      deviceList(user.id),
    ]);
    const current = deviceHash(req);
    res.json({
      two_factor: { enabled_at: user.two_factor_enabled_at, required: required.includes(user.role), recovery_codes_left: recovery },
      passkeys,
      devices: devices.map(({ device_hash, ...device }) => ({ ...device, current: device_hash === current })),
    });
  },

  forgetDevice: async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    const device = await prisma.userDevice.findFirst({ where: { id, user_id: me(req).id } });
    if (!device) throw notFound("Device not found");
    await prisma.userDevice.delete({ where: { id } });
    await audit(req, { ...target(req), action: "security.device_forgotten", metadata: { device: device.label } });
    res.json({ id, forgotten: true });
  },

  // Signs out every other device: older sessions stop working; this one gets a fresh token
  revokeSessions: async (req: Request, res: Response) => {
    const user = await prisma.user.update({ where: { id: me(req).id }, data: { token_version: { increment: 1 } } });
    await audit(req, { ...target(req), action: "security.sessions_revoked", metadata: { by: "self" } });
    res.json({ token: sessionToken(user) });
  },

  setupTwoFactor: async (req: Request, res: Response) => {
    const user = await loadMe(req);
    if (user.two_factor_enabled_at) throw new HttpError(409, "TWO_FACTOR_ALREADY_ENABLED", "Two-factor authentication is already on");
    const secret = newSecret();
    await prisma.user.update({ where: { id: user.id }, data: { two_factor_secret: secret } });
    res.json(await setupPayload(user.email, secret));
  },

  enableTwoFactor: async (req: Request, res: Response) => {
    const { code } = codeSchema.parse(req.body);
    const user = await loadMe(req);
    if (user.two_factor_enabled_at) throw new HttpError(409, "TWO_FACTOR_ALREADY_ENABLED", "Two-factor authentication is already on");
    if (!checkCode(user.two_factor_secret, code)) throw new HttpError(400, "INVALID_TWO_FACTOR_CODE", "Invalid verification code");
    await prisma.user.update({ where: { id: user.id }, data: { two_factor_enabled_at: new Date() } });
    const recovery_codes = await newRecoveryCodes(user.id);
    await audit(req, { ...target(req), action: "security.2fa_enabled" });
    res.json({ enabled: true, recovery_codes });
  },

  disableTwoFactor: async (req: Request, res: Response) => {
    const { code, password } = disableSchema.parse(req.body);
    const user = await loadMe(req);
    if (!user.two_factor_enabled_at) throw badRequest("Two-factor authentication is not on");
    if ((await getSetting("two_factor_required_roles")).includes(user.role)) {
      throw new HttpError(403, "TWO_FACTOR_REQUIRED", "The security policy requires two-factor authentication for your role");
    }
    if (!(await verifyPassword(password, user.password_hash))) throw badRequest("Password is incorrect");
    if (!checkCode(user.two_factor_secret, code)) throw new HttpError(400, "INVALID_TWO_FACTOR_CODE", "Invalid verification code");
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { two_factor_secret: null, two_factor_enabled_at: null } }),
      prisma.twoFactorRecoveryCode.deleteMany({ where: { user_id: user.id } }),
    ]);
    await audit(req, { ...target(req), action: "security.2fa_disabled" });
    res.json({ enabled: false });
  },

  passkeyOptions: async (req: Request, res: Response) => {
    const user = await loadMe(req);
    const existing = await prisma.passkey.findMany({ where: { user_id: user.id }, select: { credential_id: true, transports: true } });
    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: rpId(),
      userName: user.email,
      userDisplayName: `${user.name} ${user.last_name}`,
      userID: new TextEncoder().encode(`nova-user-${user.id}`),
      attestationType: "none",
      excludeCredentials: existing.map((p) => ({ id: p.credential_id, transports: p.transports?.split(",") })),
      // a discoverable credential, unlocked by the person (fingerprint, device PIN)
      authenticatorSelection: { residentKey: "required", userVerification: "required" },
    });
    res.json({ options, challenge_token: stepToken("webauthn-register", { id: user.id, challenge: options.challenge }, "5m") });
  },

  passkeyVerify: async (req: Request, res: Response) => {
    const { challenge_token, response, label } = passkeyVerifySchema.parse(req.body);
    const step = readStepToken<{ id: number; challenge: string }>(challenge_token, "webauthn-register");
    if (!step || step.id !== me(req).id) throw new HttpError(401, "INVALID_STEP_TOKEN", "This step has expired, start again");
    let info;
    try {
      const result = await verifyRegistrationResponse({
        response: response as unknown as RegistrationResponseJSON,
        expectedChallenge: step.challenge,
        expectedOrigin: expectedOrigins(req),
        expectedRPID: rpId(),
        requireUserVerification: true,
      });
      info = result.verified ? result.registrationInfo : null;
    } catch {
      info = null;
    }
    if (!info) throw new HttpError(400, "INVALID_PASSKEY", "The passkey could not be verified");
    const passkey = await prisma.passkey.create({
      data: {
        user_id: me(req).id,
        credential_id: info.credential.id,
        public_key: Buffer.from(info.credential.publicKey),
        counter: info.credential.counter,
        transports: info.credential.transports?.join(",") ?? null,
        label,
      },
      select: { id: true, label: true, created_at: true, last_used_at: true },
    });
    await audit(req, { ...target(req), action: "security.passkey_added", metadata: { passkey: label } });
    res.status(201).json(passkey);
  },

  passkeys: async (req: Request, res: Response) => {
    res.json(await passkeyList(me(req).id));
  },

  deletePasskey: async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    const passkey = await prisma.passkey.findFirst({ where: { id, user_id: me(req).id } });
    if (!passkey) throw notFound("Passkey not found");
    await prisma.passkey.delete({ where: { id } });
    await audit(req, { ...target(req), action: "security.passkey_revoked", metadata: { passkey: passkey.label, by: "self" } });
    res.json({ id, deleted: true });
  },
};

export default meSecurityController;
