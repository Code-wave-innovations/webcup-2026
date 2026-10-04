import fs from "fs";
import path from "path";

// Reads the routers and index.ts to list every route with the permission key (or legacy guard)
// that protects it. Used by scripts/check-permissions.ts (D09).

export type Guard = "public" | "authenticated" | "staff" | "admin";
export interface RouteInfo {
  method: string;
  path: string;
  guard: Guard;
  /** When the route uses requirePermission("key") */
  permission?: string;
}

const ROOT = path.resolve(__dirname, "..");

const strongest = (guards: Guard[]): Guard =>
  guards.includes("admin") ? "admin" : guards.includes("staff") ? "staff" : guards.includes("authenticated") ? "authenticated" : "public";

const guardsIn = (text: string): Guard[] => {
  const guards: Guard[] = [];
  if (/\brequireAdmin\b/.test(text)) guards.push("admin");
  if (/\brequireStaff\b/.test(text)) guards.push("staff");
  if (/\bauthenticate\b/.test(text)) guards.push("authenticated");
  return guards;
};

const permissionIn = (text: string): string | undefined => {
  const match = text.match(/requirePermission\(\s*["']([^"']+)["']\s*\)/);
  return match?.[1];
};

export function listRoutes(): RouteInfo[] {
  const index = fs.readFileSync(path.join(ROOT, "index.ts"), "utf8");
  const imports = new Map<string, string>();
  for (const match of index.matchAll(/import (\w+) from '\.\/src\/router\/([\w.]+)'/g)) imports.set(match[1], match[2]);
  const routes: RouteInfo[] = [];
  for (const match of index.matchAll(/app\.use\('(\/api\/[^']*)', (\w+)\)/g)) {
    const [, base, routerName] = match;
    const file = imports.get(routerName);
    if (!file) continue;
    const source = fs.readFileSync(path.join(ROOT, "src/router", `${file}.ts`), "utf8");
    const aliases = new Map<string, string>();
    for (const alias of source.matchAll(/^const (\w+) = \[(.*)\];/gm)) aliases.set(alias[1], alias[2]);
    const expand = (text: string) => text.replace(/\.\.\.(\w+)/g, (all, name: string) => aliases.get(name) ?? all);
    let inheritedGuards: Guard[] = [];
    let inheritedPermission: string | undefined;
    for (const raw of source.split("\n")) {
      const line = expand(raw);
      const use = line.match(/^\w+Router\.use\((.*)\);/);
      if (use) {
        inheritedGuards = [...inheritedGuards, ...guardsIn(use[1])];
        inheritedPermission = permissionIn(use[1]) ?? inheritedPermission;
      }
      const route = line.match(/^\w+Router\.(get|post|patch|put|delete)\("([^"]*)",(.*)\);/);
      if (!route) continue;
      const [, method, sub, rest] = route;
      const permission = permissionIn(rest) ?? inheritedPermission;
      routes.push({
        method: method.toUpperCase(),
        path: `${base}${sub === "/" ? "" : sub}`,
        guard: strongest([...inheritedGuards, ...guardsIn(rest), ...(permission ? (["authenticated"] as Guard[]) : [])]),
        permission,
      });
    }
  }
  return routes;
}
