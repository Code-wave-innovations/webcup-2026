import { PERMISSIONS } from "../src/lib/permissions";
import { listRoutes } from "./routes";

// D09: fails when the roles matrix (src/lib/permissions.ts) no longer describes the routers.
// Every route guarded by requireStaff or requireAdmin must be declared, with the same guard.

const declared = new Map(PERMISSIONS.flatMap((permission) => permission.routes.map((route) => [`${route.method} ${route.path}`, { route, permission }] as const)));
const problems: string[] = [];

for (const route of listRoutes()) {
  if (route.guard !== "staff" && route.guard !== "admin") continue;
  const key = `${route.method} ${route.path}`;
  const entry = declared.get(key);
  if (!entry) problems.push(`missing: ${key} (${route.guard}) is not in any permission`);
  else if (entry.route.guard !== route.guard) problems.push(`guard: ${key} is ${route.guard} in the router, ${entry.route.guard} in ${entry.permission.key}`);
  declared.delete(key);
}
for (const [key, { permission }] of declared) problems.push(`stale: ${key} (${permission.key}) has no staff/admin route`);
for (const permission of PERMISSIONS) {
  const adminOnly = permission.routes.every((route) => route.guard === "admin");
  if (adminOnly && permission.roles.some((role) => role !== "ADMIN")) problems.push(`roles: ${permission.key} only has admin routes but lists ${permission.roles.join(", ")}`);
}

if (problems.length) {
  console.error(`Roles matrix out of date (${problems.length}):\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log(`Roles matrix OK: ${PERMISSIONS.length} permissions, every guarded route declared.`);
