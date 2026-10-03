import Fastify from "fastify";
import multipart from "@fastify/multipart";
import type { FastifyInstance } from "fastify";
import type { Config } from "./config.js";
import { authPlugin } from "./plugins/auth.js";
import { healthRoutes } from "./routes/health.js";
import { transcriptionRoutes, type TranscriptionRouteDeps } from "./routes/transcriptions.js";

export type AppDeps = TranscriptionRouteDeps;

export async function buildApp(config: Config, deps: AppDeps = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  await app.register(multipart, {
    limits: { fileSize: config.MAX_AUDIO_BYTES, files: 1 },
  });

  await app.register(healthRoutes);
  // Registered with fastify-plugin: the hook applies to everything registered after it.
  await app.register(authPlugin(config));
  await app.register(transcriptionRoutes(config, deps));

  return app;
}
