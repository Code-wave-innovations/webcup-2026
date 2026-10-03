import assert from "node:assert/strict";
import { test } from "node:test";
import { shouldRefine } from "../src/modules/refiner/should-refine.js";

const cases: Array<{
  name: string;
  input: Parameters<typeof shouldRefine>[0];
  refine: boolean;
  reason: string;
}> = [
  { name: "empty", input: { text: "   " }, refine: false, reason: "empty" },
  {
    name: "low confidence",
    input: { text: "bonjour le monde", confidence: 0.4 },
    refine: true,
    reason: "low_confidence",
  },
  {
    name: "high confidence",
    input: { text: "bonjour le monde", confidence: 0.9 },
    refine: false,
    reason: "high_confidence",
  },
  {
    name: "short clean no confidence",
    input: { text: "bonjour" },
    refine: true,
    reason: "short_clean",
  },
  {
    name: "script mismatch",
    input: { text: "Привет мир это тест", languageHints: ["fr"] },
    refine: true,
    reason: "script_mismatch",
  },
  {
    name: "noisy text",
    input: { text: "aaaaaaa !!!! ##### ..... ....." },
    refine: true,
    reason: "noisy_text",
  },
  {
    name: "default ok longer clean",
    input: {
      text: "bonjour tout le monde comment allez vous aujourd hui",
    },
    refine: false,
    reason: "default_ok",
  },
  {
    name: "malagasy hint forces refine even high confidence",
    input: { text: "bonjour", confidence: 0.95, languageHints: ["mg"] },
    refine: true,
    reason: "malagasy_hint",
  },
  {
    name: "malagasy among mixed hints forces refine",
    input: { text: "manaona", confidence: 0.9, languageHints: ["fr", "mg"] },
    refine: true,
    reason: "malagasy_hint",
  },
];

for (const c of cases) {
  test(`shouldRefine: ${c.name}`, () => {
    const out = shouldRefine(c.input);
    assert.equal(out.refine, c.refine);
    assert.equal(out.reason, c.reason);
  });
}
