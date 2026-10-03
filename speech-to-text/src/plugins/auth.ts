import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import type { Config } from "../config.js";

/**
 * Global API-key guard. Wrapped with `fastify-plugin` so the onRequest hook is
 * not encapsulated and also protects routes registered afterwards (except /health).
 */
export const authPlugin = (config: Config): FastifyPluginAsync =>
  fp(
    async (app) => {
      app.addHook("onRequest", async (req, reply) => {
        if (req.url.startsWith("/health")) return;
        const header = req.headers.authorization;
        if (!header?.startsWith("Bearer ") || header.slice(7) !== config.STT_API_KEY) {
          return reply
            .code(401)
            .send({ error: { code: "UNAUTHORIZED", message: "Invalid API key" } });
        }
      });
    },
    { name: "stt-auth" },
  );
