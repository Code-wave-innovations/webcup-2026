import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyPluginAsync } from "fastify";

const packageJson = JSON.parse(
  readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "../../package.json"), "utf8"),
) as { version: string };

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", async () => ({
    status: "ok",
    version: packageJson.version,
  }));
};
