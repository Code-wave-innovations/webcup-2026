import type { FastifyPluginAsync } from "fastify";
import type { Config } from "../config.js";

export const authPlugin = (config: Config): FastifyPluginAsync => async (app) => {
  app.addHook("onRequest", async (req, reply) => {
    if (req.url.startsWith("/health")) return;
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ") || header.slice(7) !== config.STT_API_KEY) {
      return reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "Invalid API key" } });
    }
  });

  app.get("/v1/transcriptions/:id", async (_req, reply) => {
    return reply.code(404).send({
      error: { code: "NOT_FOUND", message: "Transcription not found" },
    });
  });
};
