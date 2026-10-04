import { z } from "zod";
import type { Prisma } from "@prisma/client";
import prisma from "./prisma";
import { HttpError } from "./errors";
import { MAX_ACCOUNT_FAILURES, MAX_IP_FAILURES, WINDOW_MS } from "./loginGuard";
import { MAX_REMINDER_OFFSET_MINUTES } from "./scheduler";
import { isStaff, type AuthUser } from "../middleware/auth";

// D07 / D08: platform settings edited by admins (PlatformSetting table, one row per key).
// Each key has a schema and a default: a key without a valid row uses its default, so adding
// a key needs no migration. `public` keys are also served to visitors by GET /api/settings/public.

const homeSection = z.object({
  key: z.string().trim().min(1).max(40),
  label: z.string().trim().min(1).max(80),
  enabled: z.boolean(),
});

const SETTINGS = {
  // D01: new citizens can create an account
  registration_open: { public: true, schema: z.boolean(), default: true },
  // F53: roles that must use a second factor (code or passkey). Empty by default so the demo
  // accounts keep signing in with a password; an admin turns it on in Paramètres.
  two_factor_required_roles: {
    public: false,
    schema: z.array(z.enum(["CITIZEN", "AGENT", "ADMIN"])).max(3),
    default: [] as ("CITIZEN" | "AGENT" | "ADMIN")[],
  },
  // Citizen space read-only: no new requests nor bookings (staff keeps working)
  maintenance_mode: { public: true, schema: z.boolean(), default: false },
  maintenance_message: {
    public: true,
    schema: z.string().trim().max(500),
    default: "La plateforme est en maintenance : l'envoi de demandes et la prise de rendez-vous reprendront bientôt.",
  },
  // D07: order and visibility of the home page blocks
  home_sections: {
    public: true,
    schema: z.array(homeSection).max(20),
    default: [
      { key: "alerts", label: "Alertes en cours", enabled: true },
      { key: "services", label: "Services mis en avant", enabled: true },
      { key: "disruptions", label: "Services perturbés et transports", enabled: true },
      { key: "announcements", label: "Dernières annonces", enabled: true },
      { key: "appointment", label: "Mon prochain rendez-vous", enabled: true },
      { key: "categories", label: "Catégories de services", enabled: false },
    ],
  },
  // D04: how to reach the town hall outside the platform
  support_contact: {
    public: true,
    schema: z.object({
      phone: z.string().trim().max(40),
      email: z.string().trim().max(191),
      hours: z.string().trim().max(191),
      address: z.string().trim().max(191),
    }),
    default: {
      phone: "+00 100 200",
      email: "contact@novaterra.city",
      hours: "Lundi–vendredi 8h–17h, samedi 8h–12h",
      address: "Hôtel de ville, place du Conseil, Centre-Ville",
    },
  },
  // F46: numbers shown on the emergency page
  emergency_numbers: {
    public: true,
    schema: z
      .array(z.object({ label: z.string().trim().min(1).max(60), number: z.string().trim().min(1).max(20) }))
      .max(12),
    default: [
      { label: "SAMU (urgence médicale)", number: "15" },
      { label: "Police secours", number: "17" },
      { label: "Pompiers", number: "18" },
      { label: "Numéro d'urgence européen", number: "112" },
      { label: "Standard de la mairie", number: "+00 100 200" },
    ],
  },
  // F40: reminder offered by default when booking an appointment
  reminder_default_minutes: {
    public: true,
    schema: z.number().int().min(15).max(MAX_REMINDER_OFFSET_MINUTES),
    default: 1440,
  },
};

type Definitions = typeof SETTINGS;
export type SettingKey = keyof Definitions;
export type Settings = { [K in SettingKey]: z.infer<Definitions[K]["schema"]> };

const KEYS = Object.keys(SETTINGS) as SettingKey[];

// PATCH body: any subset of the keys, each validated by its own schema; unknown keys are rejected.
export const settingsPatchSchema = z
  .object(Object.fromEntries(KEYS.map((key) => [key, SETTINGS[key].schema.optional()])) as {
    [K in SettingKey]: z.ZodOptional<Definitions[K]["schema"]>;
  })
  .strict();

export type SettingsPatch = z.infer<typeof settingsPatchSchema>;

// Per-process cache. With several processes (Passenger), another process may serve the
// previous value for up to CACHE_MS after a change.
const CACHE_MS = 30_000;
let cache: { at: number; values: Settings } | null = null;

export async function getSettings(): Promise<Settings> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.values;
  const rows = await prisma.platformSetting.findMany({ where: { key: { in: KEYS } } });
  const values = Object.fromEntries(KEYS.map((key) => [key, SETTINGS[key].default])) as Settings;
  for (const row of rows) {
    const key = row.key as SettingKey;
    const parsed = SETTINGS[key].schema.safeParse(row.value);
    // An invalid row (edited by hand) falls back to the default instead of breaking the app
    if (parsed.success) (values as Record<SettingKey, unknown>)[key] = parsed.data;
  }
  cache = { at: Date.now(), values };
  return values;
}

export const getSetting = async <K extends SettingKey>(key: K): Promise<Settings[K]> => (await getSettings())[key];

export const publicSettings = (values: Settings) =>
  Object.fromEntries(KEYS.filter((key) => SETTINGS[key].public).map((key) => [key, values[key]])) as Partial<Settings>;

export async function updateSettings(patch: SettingsPatch, actorId: number): Promise<Settings> {
  const entries = Object.entries(patch).filter(([, value]) => value !== undefined) as [SettingKey, unknown][];
  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.platformSetting.upsert({
        where: { key },
        create: { key, value: value as Prisma.InputJsonValue, updated_by_id: actorId },
        update: { value: value as Prisma.InputJsonValue, updated_by_id: actorId },
      })
    )
  );
  cache = null;
  return getSettings();
}

// Who changed each key, and when (keys still on their default have no entry)
export const settingsHistory = async () =>
  Object.fromEntries(
    (
      await prisma.platformSetting.findMany({
        where: { key: { in: KEYS } },
        select: { key: true, updated_at: true, updated_by: { select: { id: true, name: true, last_name: true } } },
      })
    ).map(({ key, ...rest }) => [key, rest])
  );

// F37: login protection thresholds, fixed in lib/loginGuard.ts (shown read-only to admins)
export const securityPolicy = () => ({
  max_account_failures: MAX_ACCOUNT_FAILURES,
  max_ip_failures: MAX_IP_FAILURES,
  window_minutes: WINDOW_MS / 60_000,
  lock_minutes: WINDOW_MS / 60_000,
});

// Maintenance mode: citizens can still read everything, but cannot send requests nor book.
export async function assertNotInMaintenance(user?: AuthUser) {
  if (isStaff(user)) return;
  const { maintenance_mode, maintenance_message } = await getSettings();
  if (maintenance_mode) throw new HttpError(503, "MAINTENANCE", maintenance_message);
}
