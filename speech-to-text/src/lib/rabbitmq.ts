import amqp, { type Channel, type ChannelModel, type ConsumeMessage } from "amqplib";
import { loadConfig } from "../config.js";

export const TRANSCRIPTION_QUEUE = "stt.transcription.jobs";
export const MAX_JOB_RETRIES = 3;

export type RabbitHandles = {
  connection: ChannelModel;
  channel: Channel;
};

export type TranscriptionJobHandler = (jobId: string) => Promise<void>;

let sharedConnect: Promise<RabbitHandles> | null = null;

/** Clears the lazy connection used by {@link publishTranscriptionJob} (tests only). */
export function resetRabbitConnectionForTests(): void {
  sharedConnect = null;
}

export async function connectRabbit(url: string): Promise<RabbitHandles> {
  const connection = await amqp.connect(url);
  const channel = await connection.createChannel();
  await assertTranscriptionQueue(channel);
  return { connection, channel };
}

export async function closeRabbit(handles: RabbitHandles): Promise<void> {
  await handles.channel.close();
  await handles.connection.close();
}

export async function assertTranscriptionQueue(channel: Channel): Promise<void> {
  await channel.assertQueue(TRANSCRIPTION_QUEUE, { durable: true });
}

function encodeJobMessage(jobId: string): Buffer {
  return Buffer.from(JSON.stringify({ jobId }), "utf8");
}

export function parseJobMessage(content: Buffer): string {
  const raw = content.toString("utf8");
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      const jobId = (parsed as { jobId?: unknown }).jobId;
      if (typeof jobId === "string" && jobId.length > 0) return jobId;
      throw new Error("Invalid transcription job message");
    }
  } catch (err) {
    if (err instanceof Error && err.message === "Invalid transcription job message") {
      throw err;
    }
    // fall through — plain job id string
  }
  const trimmed = raw.trim();
  if (trimmed) return trimmed;
  throw new Error("Invalid transcription job message");
}

function getRetryCount(msg: ConsumeMessage): number {
  const headers = msg.properties.headers ?? {};
  const value = headers["x-retry-count"];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

async function getSharedChannel(): Promise<Channel> {
  if (!sharedConnect) {
    const url = loadConfig().RABBITMQ_URL;
    sharedConnect = connectRabbit(url);
  }
  const handles = await sharedConnect;
  return handles.channel;
}

export async function publishTranscriptionJob(jobId: string): Promise<void> {
  const channel = await getSharedChannel();
  await publishTranscriptionJobOnChannel(channel, jobId);
}

export async function publishTranscriptionJobOnChannel(
  channel: Channel,
  jobId: string,
  retryCount = 0,
): Promise<void> {
  await assertTranscriptionQueue(channel);
  channel.sendToQueue(TRANSCRIPTION_QUEUE, encodeJobMessage(jobId), {
    persistent: true,
    contentType: "application/json",
    headers: { "x-retry-count": retryCount },
  });
}

export async function handleTranscriptionDelivery(
  channel: Channel,
  msg: ConsumeMessage,
  handler: TranscriptionJobHandler,
  maxRetries: number = MAX_JOB_RETRIES,
): Promise<void> {
  let jobId: string;
  try {
    jobId = parseJobMessage(msg.content);
  } catch {
    channel.nack(msg, false, false);
    return;
  }

  try {
    await handler(jobId);
    channel.ack(msg);
  } catch {
    const retryCount = getRetryCount(msg);
    if (retryCount + 1 >= maxRetries) {
      channel.nack(msg, false, false);
      return;
    }
    channel.ack(msg);
    await publishTranscriptionJobOnChannel(channel, jobId, retryCount + 1);
  }
}

/**
 * Registers a durable-queue consumer. Prefetch 1; ack on success; re-publish with
 * incremented retry header until {@link maxRetries}, then nack without requeue.
 */
export async function consumeTranscriptionJobs(
  channel: Channel,
  handler: TranscriptionJobHandler,
  options?: { maxRetries?: number },
): Promise<void> {
  await assertTranscriptionQueue(channel);
  channel.prefetch(1);
  const maxRetries = options?.maxRetries ?? MAX_JOB_RETRIES;
  await channel.consume(TRANSCRIPTION_QUEUE, (msg) => {
    if (!msg) return;
    void handleTranscriptionDelivery(channel, msg, handler, maxRetries);
  });
}
