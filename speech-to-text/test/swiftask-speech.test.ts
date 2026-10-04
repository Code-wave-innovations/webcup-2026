import assert from "node:assert/strict";
import { test } from "node:test";
import { createSwiftaskSpeech, SpeechProviderError } from "../src/modules/tts/swiftask-speech.js";

async function read(audio: AsyncIterable<Uint8Array>): Promise<string> {
  const parts: Buffer[] = [];
  for await (const chunk of audio) parts.push(Buffer.from(chunk));
  return Buffer.concat(parts).toString();
}

test("asks Swiftask's bot for the line, downloads its mp3 and reuses the conversation", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const fakeFetch = (async (url: string, init?: RequestInit) => {
    requests.push({ url, init });
    if (url.endsWith("/api/ai/elevenlabs")) {
      return Response.json({ text: "ok", sessionId: 42, files: [{ url: "https://s3.example/nova.mp3" }] });
    }
    return new Response("ID3-audio");
  }) as typeof fetch;
  const speech = createSwiftaskSpeech({ apiKey: "sk-swiftask", apiUrl: "https://swiftask.example/", fetch: fakeFetch });

  assert.equal(await read(await speech.stream("Bonjour !")), "ID3-audio");
  const call = requests[0]!;
  assert.equal(call.url, "https://swiftask.example/api/ai/elevenlabs");
  assert.equal((call.init?.headers as Record<string, string>).authorization, "Bearer sk-swiftask");
  const body = JSON.parse(String(call.init?.body));
  assert.equal(body.input, "Bonjour !");
  assert.equal(body.sessionId, undefined);
  assert.equal(body.extraConfig.voice, "George");
  assert.equal(body.extraConfig.model_id, "eleven_multilingual_v2");
  assert.equal(requests[1]!.url, "https://s3.example/nova.mp3");

  await read(await speech.stream("Encore."));
  assert.equal(JSON.parse(String(requests[2]!.init?.body)).sessionId, 42);
  assert.equal(speech.id, "swiftask:elevenlabs:George:eleven_multilingual_v2");
});

test("fails with a provider error when the bot answers without audio", async () => {
  const fakeFetch = (async () => Response.json({ text: "Voice 'X' not found", isBotError: true, files: [] })) as unknown as typeof fetch;
  const speech = createSwiftaskSpeech({ apiKey: "k", fetch: fakeFetch });
  await assert.rejects(speech.stream("Bonjour"), SpeechProviderError);
});

test("passes Swiftask's own status on (e.g. 401 for a bad key)", async () => {
  const fakeFetch = (async () => Response.json({ error: "Unauthorized" }, { status: 401 })) as unknown as typeof fetch;
  const speech = createSwiftaskSpeech({ apiKey: "bad", fetch: fakeFetch });
  await assert.rejects(speech.stream("Bonjour"), (err: unknown) => err instanceof SpeechProviderError && err.status === 401);
});
