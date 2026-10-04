import fs from "fs";
import path from "path";

// Reads the routers and index.ts to list every route with the guard that protects it.
// Used by scripts/check-permissions.ts (D09: the roles matrix must describe what the server applies).

export type Guard = "public" | "authenticated" | "staff" | "admin";
export interface RouteInfo {
  method: string;
  path: string;
  guard: Guard;
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
    // guards set with router.use(...) apply to the routes declared after them;
    // `const staff = [authenticate, requireStaff]` lists are expanded where they are spread
    const aliases = new Map<string, string>();
    for (const alias of source.matchAll(/^const (\w+) = \[(.*)\];/gm)) aliases.set(alias[1], alias[2]);
    const expand = (text: string) => text.replace(/\.\.\.(\w+)/g, (all, name: string) => aliases.get(name) ?? all);
    let inherited: Guard[] = [];
    for (const raw of source.split("\n")) {
      const line = expand(raw);
      const use = line.match(/^\w+Router\.use\((.*)\);/);
      if (use) inherited = [...inherited, ...guardsIn(use[1])];
      const route = line.match(/^\w+Router\.(get|post|patch|put|delete)\("([^"]*)",(.*)\);/);
      if (!route) continue;
      const [, method, sub, rest] = route;
      routes.push({
        method: method.toUpperCase(),
        path: `${base}${sub === "/" ? "" : sub}`,
        guard: strongest([...inherited, ...guardsIn(rest)]),
      });
    }
  }
  return routes;
}
