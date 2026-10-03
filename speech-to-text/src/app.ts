import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import type { Config } from "./config.js";
import { authPlugin } from "./plugins/auth.js";
import { healthRoutes } from "./routes/health.js";

export async function buildApp(config: Config): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  await app.register(healthRoutes);
  await app.register(authPlugin(config));

  return app;
}
