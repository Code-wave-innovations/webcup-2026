import { loadConfig } from "../config.js";
import {
  closeRabbit,
  connectRabbit,
  consumeTranscriptionJobs,
  TRANSCRIPTION_QUEUE,
} from "../lib/rabbitmq.js";
import { runTranscriptionJob } from "../modules/pipeline/run-transcription.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const rabbit = await connectRabbit(config.RABBITMQ_URL);

  const shutdown = async (signal: string): Promise<void> => {
    console.log(JSON.stringify({ event: "worker.shutdown", signal }));
    try {
      await closeRabbit(rabbit);
    } finally {
      process.exit(0);
    }
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));

  console.log(
    JSON.stringify({
      event: "worker.started",
      queue: TRANSCRIPTION_QUEUE,
    }),
  );

  await consumeTranscriptionJobs(rabbit.channel, runTranscriptionJob);
}

main().catch((err: unknown) => {
  console.error(
    JSON.stringify({
      event: "worker.fatal",
      error: err instanceof Error ? err.message : String(err),
    }),
  );
  process.exit(1);
});
