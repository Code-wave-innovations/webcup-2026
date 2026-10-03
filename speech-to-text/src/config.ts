import { z } from "zod";
import "dotenv/config";

const schema = z.object({
  PORT: z.coerce.number().default(9100),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  RABBITMQ_URL: z.string().default("amqp://guest:guest@localhost:5672"),
  STT_API_KEY: z.string().min(8),
  OPENAI_API_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  OPENROUTER_API_KEY: z.string().optional(),
  MAX_AUDIO_BYTES: z.coerce.number().default(25_000_000),
  MAX_AUDIO_DURATION_SEC: z.coerce.number().default(7200),
  ASYNC_DURATION_THRESHOLD_SEC: z.coerce.number().default(120),
  CONFIDENCE_FALLBACK_THRESHOLD: z.coerce.number().default(0.55),
  RETAIN_AUDIO_DEFAULT: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(): Config {
  return schema.parse(process.env);
}
