import type { FastifyPluginAsync } from "fastify";
import type { Config } from "../config.js";
import { createRealtimeTokenIssuer } from "../modules/realtime/tokens.js";

export interface RealtimeTokensRouteDeps {
  issuer?: ReturnType<typeof createRealtimeTokenIssuer>;
}

export const realtimeTokensRoutes =
  (config: Config, deps: RealtimeTokensRouteDeps = {}): FastifyPluginAsync =>
  async (app) => {
    const issuer =
      deps.issuer ?? createRealtimeTokenIssuer(config.STT_API_KEY, config.REALTIME_TOKEN_TTL_SEC);

    app.post("/v1/realtime/tokens", async (_req, reply) => {
      const { token, expiresAt } = issuer.issue();
      return reply.code(201).send({
        token,
        expiresAt: new Date(expiresAt).toISOString(),
        wsUrl: `/v1/transcriptions/realtime`,
      });
    });
  };
