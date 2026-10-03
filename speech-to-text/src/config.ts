import { z } from "zod";
import "dotenv/config";

const schema = z.object({
    PORT: z.coerce.number().default(9100),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().default("redis://localhost:6379"),
    RABBITMQ_URL: z.string().default("amqp://guest:guest@localhost:5672"),
    STT_API_KEY: z.string().min(8),
    OPENROUTER_API_KEY: z.string().min(1),
    OPENROUTER_STT_MODEL: z.string().default("openai/whisper-large-v3"),
    /** Realtime STT model — turbo default for lower latency; batch STT stays large-v3. */
    OPENROUTER_REALTIME_STT_MODEL: z.string().default("openai/whisper-large-v3-turbo"),
    OPENROUTER_BASE_URL: z.string().default("https://openrouter.ai/api/v1"),
    OPENAI_API_KEY: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().min(1),
    CLAUDE_REFINER_MODEL: z.string().default("claude-sonnet-4-5-20250929"),
    CLAUDE_ASSISTANT_MODEL: z.string().optional(),
    MAX_AUDIO_BYTES: z.coerce.number().default(25_000_000),
    CORS_ORIGINS: z
        .string()
        .default("http://localhost:5173")
        .transform((v) => v.split(",").map((s) => s.trim())),
    MAX_AUDIO_DURATION_SEC: z.coerce.number().default(720),
    ASYNC_DURATION_THRESHOLD_SEC: z.coerce.number().default(120),
    CONFIDENCE_FALLBACK_THRESHOLD: z.coerce.number().default(0.55),
    REALTIME_TOKEN_TTL_SEC: z.coerce.number().default(300),
    REALTIME_CHUNK_MAX_BYTES: z.coerce.number().default(1_000_000),
    /** Client VAD already gates silence; skip extra FFmpeg gate for lower latency. */
    REALTIME_SKIP_SPEECH_GATE: z
        .enum(["true", "false"])
        .default("true")
        .transform((v) => v === "true"),
    RETAIN_AUDIO_DEFAULT: z
        .enum(["true", "false"])
        .default("false")
        .transform((v) => v === "true"),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(): Config {
    return schema.parse(process.env);
}
