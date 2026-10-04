import type { Request, Response } from "express";
import { z } from "zod";
import { audit } from "../lib/audit";
import { listEffectivePermissions, setPermissionRoles } from "../lib/roleGrants";

const patchSchema = z.object({
  roles: z.array(z.enum(["AGENT", "ADMIN"])).max(2),
});

const permissionController = {
  list: async (_req: Request, res: Response) => {
    res.json(await listEffectivePermissions());
  },

  update: async (req: Request, res: Response) => {
    const key = String(req.params.key ?? "");
    const { roles } = patchSchema.parse(req.body);
    const before = (await listEffectivePermissions()).find((p) => p.key === key);
    const after = await setPermissionRoles(key, roles, req.user!.id);
    await audit(req, {
      action: "permissions.updated",
      entity: "Permission",
      entityId: null,
      label: after.label,
      before: before ? { roles: before.roles } : null,
      after: { roles: after.roles },
      fields: ["roles"],
      metadata: { key },
    });
    res.json(after);
  },
};

export default permissionController;
