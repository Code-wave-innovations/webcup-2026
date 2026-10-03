import assert from "node:assert/strict";
import { test } from "node:test";
import {
  REFINER_SYSTEM_PROMPT,
  buildRefinerUserMessage,
  createClaudeRefiner,
  parseRefinerResponse,
} from "../src/modules/refiner/claude-refiner.js";

test("REFINER_SYSTEM_PROMPT includes global refiner constraints", () => {
  assert.match(REFINER_SYSTEM_PROMPT, /Do not invent facts/i);
  assert.match(REFINER_SYSTEM_PROMPT, /ASR errors, punctuation, and casing/i);
  assert.match(REFINER_SYSTEM_PROMPT, /dictionaryTerms/i);
  assert.match(REFINER_SYSTEM_PROMPT, /text only, never audio/i);
  assert.match(REFINER_SYSTEM_PROMPT, /languageHints includes "mg"/i);
  assert.match(REFINER_SYSTEM_PROMPT, /ONLY \["mg"\]/i);
});

test("parseRefinerResponse parses JSON transcript payload", () => {
  const result = parseRefinerResponse(
    JSON.stringify({
      text: "Bonjour le monde",
      segments: [{ startMs: 0, endMs: 1200, text: "Bonjour" }],
    }),
  );

  assert.equal(result.text, "Bonjour le monde");
  assert.equal(result.segments.length, 1);
  assert.equal(result.segments[0].text, "Bonjour");
});

test("createClaudeRefiner sends system prompt with Do not translate", async () => {
  const captured: { system?: string; user?: string } = {};
  const { refineTranscript } = createClaudeRefiner("sk-ant-test", {
    client: {
      messages: {
        create: async (body: {
          system?: string;
          messages?: { content: string }[];
        }) => {
          captured.system = body.system;
          captured.user = body.messages?.[0]?.content;
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  text: "Fanampiana ERP",
                  segments: [{ startMs: 0, endMs: 500, text: "Fanampiana ERP" }],
                }),
              },
            ],
          };
        },
      },
    },
  });

  const input = {
    text: "fanampiana erp",
    segments: [{ startMs: 0, endMs: 500, text: "fanampiana erp" }],
    dictionaryTerms: ["Fanampiana"],
    context: { domain: "ERP", keywords: ["Dolibarr"] },
    languageHints: ["mg", "fr"],
  };

  const result = await refineTranscript(input);

  assert.ok(captured.system?.includes("Do not translate"));
  assert.equal(result.text, "Fanampiana ERP");
  assert.ok(captured.user?.includes("fanampiana erp"));
  assert.ok(buildRefinerUserMessage(input).includes("Fanampiana"));
});
