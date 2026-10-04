import { PERMISSIONS } from "../src/lib/permissions";
import { listRoutes } from "./routes";

// D09: every requirePermission("key") route must be declared on that permission;
// every matrix route must appear on a router with that key.

const byRoute = new Map(PERMISSIONS.flatMap((permission) => permission.routes.map((route) => [`${route.method} ${route.path}`, permission.key] as const)));
const problems: string[] = [];

for (const route of listRoutes()) {
  if (!route.permission) continue;
  const key = `${route.method} ${route.path}`;
  const declared = byRoute.get(key);
  if (!declared) problems.push(`missing: ${key} uses requirePermission("${route.permission}") but is not in the matrix`);
  else if (declared !== route.permission) {
    problems.push(`key: ${key} is under "${declared}" in the matrix but requirePermission("${route.permission}") in the router`);
  }
  byRoute.delete(key);
}

for (const [key, permissionKey] of byRoute) {
  problems.push(`stale: ${key} (${permissionKey}) has no requirePermission("${permissionKey}") route`);
}

if (problems.length) {
  console.error(`Roles matrix out of date (${problems.length}):\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log(`Roles matrix OK: ${PERMISSIONS.length} permissions, every guarded route declared.`);
