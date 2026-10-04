import crypto from "crypto";
import type { Request } from "express";
import prisma from "./prisma";
import { notifyUser } from "./notify";
import { clientIp } from "./rateLimit";

// F54: the devices an account signs in from. The browser keeps a random id (X-Device-Id); without
// it the user agent stands in. It is not a proof of identity, only a way to notice an unusual device.

export const deviceHash = (req: Request) => {
  const id = req.get("x-device-id")?.trim().slice(0, 100) || `ua:${req.get("user-agent") ?? "inconnu"}`;
  return crypto.createHash("sha256").update(id).digest("hex");
};

/** « Chrome sur macOS », read from the user agent */
export function deviceLabel(userAgent?: string): string {
  const ua = userAgent ?? "";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : /curl|node|axios|undici/i.test(ua)
              ? "Client technique"
              : "Navigateur";
  const os = /iPhone|iPad/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X|Macintosh/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : null;
  return os ? `${browser} sur ${os}` : browser;
}

const when = (date: Date) =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);

/**
 * Records the device of a successful sign-in. A device never seen on an account that already has
 * one triggers a SECURITY notification; the very first sign-in is recorded silently.
 */
export async function recordDevice(req: Request, userId: number) {
  const hash = deviceHash(req);
  const ip = clientIp(req)?.slice(0, 64) ?? null;
  const label = deviceLabel(req.get("user-agent"));
  const existing = await prisma.userDevice.findUnique({ where: { user_id_device_hash: { user_id: userId, device_hash: hash } } });
  if (existing) {
    await prisma.userDevice.update({ where: { id: existing.id }, data: { last_seen: new Date(), last_ip: ip } });
    return { device: existing, isNew: false };
  }
  const known = await prisma.userDevice.count({ where: { user_id: userId } });
  const device = await prisma.userDevice.create({ data: { user_id: userId, device_hash: hash, label, last_ip: ip } });
  if (known > 0) {
    await notifyUser(userId, {
      type: "SECURITY",
      title: `Nouvelle connexion depuis ${label}`,
      body: `Le ${when(device.first_seen)}. Ce n'était pas vous ? Déconnectez les autres appareils et changez votre mot de passe.`,
      link: "/compte",
      data: { device_id: device.id, ip },
    });
  }
  return { device, isNew: known > 0 };
}
