import type { Request, Response } from "express";
import {
  getSettings,
  publicSettings,
  securityPolicy,
  settingsHistory,
  settingsPatchSchema,
  updateSettings,
} from "../lib/settings";
import { audit } from "../lib/audit";

// D07 / D08: platform settings (keys and defaults in lib/settings.ts)

const adminView = async (values: Awaited<ReturnType<typeof getSettings>>) => ({
  settings: values,
  // F37: read-only, fixed in lib/loginGuard.ts
  security: securityPolicy(),
  updated: await settingsHistory(),
});

const settingsController = {
  // Public subset, read by the citizen space (home blocks, registration, maintenance, contacts…)
  getPublic: async (_req: Request, res: Response) => {
    res.json(publicSettings(await getSettings()));
  },
  getAll: async (_req: Request, res: Response) => {
    res.json(await adminView(await getSettings()));
  },
  update: async (req: Request, res: Response) => {
    const patch = settingsPatchSchema.parse(req.body);
    const before = await getSettings();
    const after = await updateSettings(patch, req.user!.id);
    await audit(req, {
      action: "settings.updated",
      entity: "PlatformSetting",
      label: "Paramètres de la plateforme",
      before: before as unknown as Record<string, unknown>,
      after: after as unknown as Record<string, unknown>,
      fields: Object.keys(patch),
    });
    res.json(await adminView(after));
  },
};

export default settingsController;
