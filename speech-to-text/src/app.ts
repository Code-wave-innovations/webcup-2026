import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import type { FastifyInstance } from "fastify";
import type { Config } from "./config.js";
import { authPlugin } from "./plugins/auth.js";
import { healthRoutes } from "./routes/health.js";
import { realtimeTokensRoutes } from "./routes/realtime-tokens.js";
import { realtimeWsRoutes } from "./routes/realtime-ws.js";
import { transcriptionRoutes, type TranscriptionRouteDeps } from "./routes/transcriptions.js";

export type AppDeps = TranscriptionRouteDeps;

export async function buildApp(config: Config, deps: AppDeps = {}): Promise<FastifyInstance> {
    const app = Fastify({ logger: false });

    await app.register(multipart, {
        limits: { fileSize: config.MAX_AUDIO_BYTES, files: 1 },
    });

    await app.register(cors, {
        origin: config.CORS_ORIGINS,
    });

    await app.register(healthRoutes);
    // Registered with fastify-plugin: the hook applies to everything registered after it.
    await app.register(authPlugin(config));
    await app.register(transcriptionRoutes(config, deps));
    await app.register(realtimeTokensRoutes(config));
    await app.register(realtimeWsRoutes(config));

    return app;
}
