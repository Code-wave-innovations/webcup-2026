import { z } from "zod";
import type { Prisma, Role } from "@prisma/client";
import prisma from "./prisma";
import { badRequest, forbidden } from "./errors";
import { PERMISSIONS, type Permission, type RouteGuard } from "./permissions";

/*
  D08 / D09: overrides of which staff roles hold each permission key.
  Defaults live in PERMISSIONS; this table row is only written when an admin edits the matrix.
  CITIZEN is never grantable here.
*/

const STAFF_ROLES = ["AGENT", "ADMIN"] as const;
type StaffRole = (typeof STAFF_ROLES)[number];

const grantsSchema = z.record(z.string(), z.array(z.enum(STAFF_ROLES)));

const SETTING_KEY = "role_grants";

/** Admin cannot remove these from ADMIN (would lock the matrix / staff admin out). */
export const LOCKED_ADMIN_KEYS = new Set(["permissions.manage", "staff.manage"]);

const CACHE_MS = 15_000;
let cache: { at: number; grants: Record<string, StaffRole[]> } | null = null;

export function clearRoleGrantsCache() {
  cache = null;
}

async function loadGrants(): Promise<Record<string, StaffRole[]>> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.grants;
  const row = await prisma.platformSetting.findUnique({ where: { key: SETTING_KEY } });
  const parsed = grantsSchema.safeParse(row?.value ?? {});
  const grants = parsed.success ? parsed.data : {};
  cache = { at: Date.now(), grants };
  return grants;
}

export async function saveRoleGrants(grants: Record<string, StaffRole[]>, actorId: number): Promise<void> {
  await prisma.platformSetting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: grants as Prisma.InputJsonValue, updated_by_id: actorId },
    update: { value: grants as Prisma.InputJsonValue, updated_by_id: actorId },
  });
  clearRoleGrantsCache();
}

function defaultStaffRoles(permission: Permission): StaffRole[] {
  return permission.roles.filter((role): role is StaffRole => role === "AGENT" || role === "ADMIN");
}

export function guardForRoles(roles: Role[]): RouteGuard {
  if (roles.includes("AGENT")) return "staff";
  if (roles.includes("ADMIN")) return "admin";
  return "authenticated";
}

export async function effectiveRolesFor(key: string): Promise<Role[]> {
  const permission = PERMISSIONS.find((p) => p.key === key);
  if (!permission) return [];
  const grants = await loadGrants();
  const overridden = grants[key];
  const staff = overridden ? [...new Set(overridden)] : defaultStaffRoles(permission);
  // Hard floor: locked keys always keep ADMIN
  if (LOCKED_ADMIN_KEYS.has(key) && !staff.includes("ADMIN")) staff.push("ADMIN");
  return staff;
}

export async function userHasPermission(role: Role, key: string): Promise<boolean> {
  if (role === "CITIZEN") return false;
  const roles = await effectiveRolesFor(key);
  return roles.includes(role);
}

export type EffectivePermission = Permission & {
  /** roles after overrides (never includes CITIZEN for staff matrix keys) */
  roles: Role[];
  /** which staff columns the UI may toggle */
  editable_roles: StaffRole[];
  /** staff roles that must stay on */
  locked_roles: StaffRole[];
};

export async function listEffectivePermissions(): Promise<EffectivePermission[]> {
  const grants = await loadGrants();
  return PERMISSIONS.map((permission) => {
    const staff = grants[permission.key] ? [...new Set(grants[permission.key])] : defaultStaffRoles(permission);
    if (LOCKED_ADMIN_KEYS.has(permission.key) && !staff.includes("ADMIN")) staff.push("ADMIN");
    const locked_roles: StaffRole[] = LOCKED_ADMIN_KEYS.has(permission.key) ? ["ADMIN"] : [];
    const editable_roles: StaffRole[] = STAFF_ROLES.filter((role) => !locked_roles.includes(role));
    const roles = staff as Role[];
    return {
      ...permission,
      roles,
      editable_roles,
      locked_roles,
      routes: permission.routes.map((route) => ({ ...route, guard: guardForRoles(roles) })),
    };
  });
}

export async function setPermissionRoles(key: string, roles: StaffRole[], actorId: number): Promise<EffectivePermission> {
  const permission = PERMISSIONS.find((p) => p.key === key);
  if (!permission) throw badRequest(`Unknown permission: ${key}`);

  let next = [...new Set(roles)];
  if (LOCKED_ADMIN_KEYS.has(key) && !next.includes("ADMIN")) {
    throw forbidden("This permission cannot be removed from administrators");
  }
  // Never persist empty ADMIN lock bypass; citizen never stored
  next = next.filter((role) => role === "AGENT" || role === "ADMIN");

  const grants = { ...(await loadGrants()), [key]: next };
  // Drop overrides that match the code default (keep the row small)
  const defaults = defaultStaffRoles(permission).slice().sort().join(",");
  if (next.slice().sort().join(",") === defaults) delete grants[key];

  await saveRoleGrants(grants, actorId);
  const list = await listEffectivePermissions();
  return list.find((p) => p.key === key)!;
}

/** Resolve which permission key covers a method+path (for checks / tooling). */
export function permissionKeyForRoute(method: string, path: string): string | undefined {
  const key = `${method.toUpperCase()} ${path}`;
  for (const permission of PERMISSIONS) {
    for (const route of permission.routes) {
      if (`${route.method} ${route.path}` === key) return permission.key;
    }
  }
  return undefined;
}
