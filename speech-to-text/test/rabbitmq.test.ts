import assert from "node:assert/strict";
import { test } from "node:test";
import type { Channel, ConsumeMessage } from "amqplib";
import {
  MAX_JOB_RETRIES,
  TRANSCRIPTION_QUEUE,
  assertTranscriptionQueue,
  handleTranscriptionDelivery,
  parseJobMessage,
  publishTranscriptionJobOnChannel,
} from "../src/lib/rabbitmq.js";

function fakeMessage(
  jobId: string,
  retryCount = 0,
): ConsumeMessage {
  return {
    content: Buffer.from(JSON.stringify({ jobId }), "utf8"),
    fields: {
      deliveryTag: 1,
      redelivered: false,
      exchange: "",
      routingKey: TRANSCRIPTION_QUEUE,
      consumerTag: "ctag",
    },
    properties: {
      headers: { "x-retry-count": retryCount },
    },
  } as ConsumeMessage;
}

function mockChannel() {
  const sent: Array<{ jobId: string; retryCount: number }> = [];
  const acks: ConsumeMessage[] = [];
  const nacks: Array<{ msg: ConsumeMessage; requeue: boolean }> = [];

  const channel = {
    assertQueue: async (name: string, opts: { durable: boolean }) => {
      assert.equal(name, TRANSCRIPTION_QUEUE);
      assert.equal(opts.durable, true);
    },
    sendToQueue: (
      name: string,
      body: Buffer,
      props: { headers?: Record<string, number> },
    ) => {
      assert.equal(name, TRANSCRIPTION_QUEUE);
      sent.push({
        jobId: parseJobMessage(body),
        retryCount: props.headers?.["x-retry-count"] ?? 0,
      });
      return true;
    },
    ack: (msg: ConsumeMessage) => {
      acks.push(msg);
    },
    nack: (msg: ConsumeMessage, _all: boolean, requeue: boolean) => {
      nacks.push({ msg, requeue });
    },
  } as unknown as Channel;

  return { channel, sent, acks, nacks };
}

test("parseJobMessage accepts JSON and plain string", () => {
  assert.equal(
    parseJobMessage(Buffer.from('{"jobId":"abc-123"}')),
    "abc-123",
  );
  assert.equal(parseJobMessage(Buffer.from("plain-id")), "plain-id");
  assert.throws(() => parseJobMessage(Buffer.from("   ")), /Invalid transcription job message/);
});

test("publishTranscriptionJobOnChannel uses durable queue and persistent body", async () => {
  const { channel, sent } = mockChannel();
  await publishTranscriptionJobOnChannel(channel, "job-42");
  assert.deepEqual(sent, [{ jobId: "job-42", retryCount: 0 }]);
});

test("assertTranscriptionQueue is durable", async () => {
  const { channel } = mockChannel();
  await assertTranscriptionQueue(channel);
});

test("handleTranscriptionDelivery acks after successful handler", async () => {
  const { channel, acks, nacks } = mockChannel();
  const msg = fakeMessage("ok-job");
  await handleTranscriptionDelivery(channel, msg, async () => undefined);
  assert.equal(acks.length, 1);
  assert.equal(nacks.length, 0);
});

test("handleTranscriptionDelivery re-publishes with retry then nacks without requeue", async () => {
  const { channel, sent, acks, nacks } = mockChannel();
  const msg = fakeMessage("fail-job", MAX_JOB_RETRIES - 2);
  let calls = 0;
  await handleTranscriptionDelivery(
    channel,
    msg,
    async () => {
      calls += 1;
      throw new Error("boom");
    },
    MAX_JOB_RETRIES,
  );
  assert.equal(calls, 1);
  assert.equal(acks.length, 1);
  assert.deepEqual(sent, [{ jobId: "fail-job", retryCount: MAX_JOB_RETRIES - 1 }]);
  assert.equal(nacks.length, 0);

  const finalMsg = fakeMessage("fail-job", MAX_JOB_RETRIES - 1);
  await handleTranscriptionDelivery(
    channel,
    finalMsg,
    async () => {
      throw new Error("still failing");
    },
    MAX_JOB_RETRIES,
  );
  assert.equal(nacks.length, 1);
  assert.equal(nacks[0]?.requeue, false);
  assert.equal(acks.length, 1);
});

test("handleTranscriptionDelivery nacks invalid payload without requeue", async () => {
  const { channel, nacks } = mockChannel();
  const bad = fakeMessage("");
  bad.content = Buffer.from("{}");
  await handleTranscriptionDelivery(channel, bad, async () => undefined);
  assert.equal(nacks.length, 1);
  assert.equal(nacks[0]?.requeue, false);
});

test("handleTranscriptionDelivery publishes retry BEFORE acking", async () => {
  const order: string[] = [];
  const { channel } = mockChannel();
  const ch = channel as unknown as Record<string, unknown>;
  const origSend = ch.sendToQueue as (...a: unknown[]) => boolean;
  ch.sendToQueue = (...a: unknown[]) => {
    order.push("publish");
    return origSend(...a);
  };
  ch.ack = () => {
    order.push("ack");
  };
  await handleTranscriptionDelivery(
    channel,
    fakeMessage("j", 0),
    async () => {
      throw new Error("boom");
    },
    MAX_JOB_RETRIES,
  );
  assert.deepEqual(order, ["publish", "ack"]);
});

test("handleTranscriptionDelivery does not ack and requeues when retry publish fails", async () => {
  const { channel, acks, nacks } = mockChannel();
  (channel as unknown as Record<string, unknown>).sendToQueue = () => {
    throw new Error("channel closed");
  };
  await handleTranscriptionDelivery(
    channel,
    fakeMessage("j", 0),
    async () => {
      throw new Error("boom");
    },
    MAX_JOB_RETRIES,
  );
  assert.equal(acks.length, 0);
  assert.equal(nacks.length, 1);
  assert.equal(nacks[0]?.requeue, true);
});
