import websocket from "@fastify/websocket";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";
import type { WebSocket } from "ws";
import type { Config } from "../config.js";
import {
  RealtimeSession,
  type RealtimeEvent,
  type RealtimeSessionDeps,
  type RealtimeSessionOptions,
} from "../modules/realtime/session.js";
import { createRealtimeTokenIssuer } from "../modules/realtime/tokens.js";

const sessionStartSchema = z.object({
  type: z.literal("session.start"),
  mode: z.enum(["FAST", "BALANCED", "ACCURATE"]).optional(),
  languageHints: z.array(z.string().min(1)).optional(),
  context: z
    .object({
      domain: z.string().optional(),
      keywords: z.array(z.string()).optional(),
    })
    .optional(),
});

function sendEvent(
  socket: WebSocket,
  event: RealtimeEvent | { type: "session.ready"; sessionId: string },
): void {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(event));
  }
}

function sendErrorAndClose(socket: WebSocket, code: string, message: string): void {
  sendEvent(socket, { type: "error", code, message });
  socket.close(1008, code);
}

export const realtimeWsRoutes =
  (config: Config, deps: RealtimeSessionDeps = {}): FastifyPluginAsync =>
  async (app) => {
    await app.register(websocket);
    const issuer = createRealtimeTokenIssuer(config.STT_API_KEY, config.REALTIME_TOKEN_TTL_SEC);
    // Route-level deps may omit config: always provide the API keys the session needs.
    const sessionDeps: RealtimeSessionDeps = {
      ...deps,
      config: deps.config ?? {
        OPENROUTER_API_KEY: config.OPENROUTER_API_KEY,
        OPENROUTER_STT_MODEL: config.OPENROUTER_STT_MODEL,
        OPENROUTER_REALTIME_STT_MODEL: config.OPENROUTER_REALTIME_STT_MODEL,
        OPENROUTER_BASE_URL: config.OPENROUTER_BASE_URL,
        ANTHROPIC_API_KEY: config.ANTHROPIC_API_KEY,
        CLAUDE_REFINER_MODEL: config.CLAUDE_REFINER_MODEL,
        CONFIDENCE_FALLBACK_THRESHOLD: config.CONFIDENCE_FALLBACK_THRESHOLD,
        REALTIME_SKIP_SPEECH_GATE: config.REALTIME_SKIP_SPEECH_GATE,
      },
    };

    app.get("/v1/transcriptions/realtime", { websocket: true }, async (socket, req: FastifyRequest) => {
      // Browsers cannot set headers on WebSocket: auth via ephemeral ?token= instead of Bearer.
      const url = new URL(req.url, "http://localhost");
      const token = url.searchParams.get("token") ?? "";
      if (!issuer.verify(token)) {
        sendErrorAndClose(socket, "UNAUTHORIZED", "Invalid or expired realtime token");
        return;
      }

      let session: RealtimeSession | null = null;
      let started = false;

      socket.on("message", (data: Buffer, isBinary: boolean) => {
        void (async () => {
          if (isBinary) {
            if (!session) {
              sendEvent(socket, {
                type: "error",
                code: "SESSION_NOT_STARTED",
                message: "Send session.start first",
              });
              return;
            }
            if (data.length > config.REALTIME_CHUNK_MAX_BYTES) {
              sendEvent(socket, {
                type: "error",
                code: "CHUNK_TOO_LARGE",
                message: `Audio chunk exceeds ${config.REALTIME_CHUNK_MAX_BYTES} bytes`,
              });
              return;
            }
            const events = await session.handleChunk(data, (event) => {
              sendEvent(socket, event);
            });
            // Events already streamed via emit; keep return for metrics/tests only.
            void events;
            return;
          }

          let msg: Record<string, unknown>;
          try {
            msg = JSON.parse(data.toString("utf8")) as Record<string, unknown>;
          } catch {
            sendEvent(socket, { type: "error", code: "INVALID_MESSAGE", message: "Expected JSON text or binary audio" });
            return;
          }

          if (msg.type === "session.start") {
            if (started) {
              sendEvent(socket, { type: "error", code: "ALREADY_STARTED", message: "Session already started" });
              return;
            }
            const parsed = sessionStartSchema.safeParse(msg);
            if (!parsed.success) {
              sendEvent(socket, {
                type: "error",
                code: "INVALID_SESSION_START",
                message: parsed.error.issues.map((i) => i.message).join("; "),
              });
              return;
            }
            const options: RealtimeSessionOptions = {
              mode: (parsed.data.mode ?? "BALANCED") as RealtimeSessionOptions["mode"],
              ...(parsed.data.languageHints ? { languageHints: parsed.data.languageHints } : {}),
              ...(parsed.data.context ? { context: parsed.data.context } : {}),
            };
            session = new RealtimeSession(sessionDeps);
            await session.start(options);
            started = true;
            sendEvent(socket, { type: "session.ready", sessionId: session.id });
            return;
          }

          if (msg.type === "session.end") {
            await session?.end();
            socket.close(1000, "session.end");
            return;
          }

          sendEvent(socket, { type: "error", code: "UNKNOWN_EVENT", message: `Unknown event type` });
        })().catch((err: unknown) => {
          sendEvent(socket, {
            type: "error",
            code: "REALTIME_ERROR",
            message: err instanceof Error ? err.message : "Internal realtime error",
          });
        });
      });

      socket.on("close", () => {
        void session?.end();
      });
    });
  };
