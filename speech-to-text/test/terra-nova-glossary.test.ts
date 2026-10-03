import assert from "node:assert/strict";
import { test } from "node:test";
import { buildLanguagePrompt } from "../src/modules/stt/language.js";
import {
  dictionaryTermsForHints,
  hintsIncludeMalagasy,
  mergePromptContext,
} from "../src/modules/stt/terra-nova-glossary.js";

test("hintsIncludeMalagasy detects mg", () => {
  assert.equal(hintsIncludeMalagasy(["fr"]), false);
  assert.equal(hintsIncludeMalagasy(["mg"]), true);
  assert.equal(hintsIncludeMalagasy(["fr", "MG"]), true);
});

test("mergePromptContext adds Malagasy guidance when mg hinted", () => {
  const merged = mergePromptContext(["mg"], "domain: city");
  assert.ok(merged);
  assert.match(merged, /Manao ahoana/i);
  assert.match(merged, /Misaotra/i);
});

test("mergePromptContext leaves fr-only context alone when meta", () => {
  assert.equal(mergePromptContext(["fr"], undefined), undefined);
});

test("buildLanguagePrompt for fr uses French seed not English instructions", () => {
  const p = buildLanguagePrompt(["fr"], undefined);
  assert.ok(p);
  assert.match(p, /Bonjour/);
  assert.doesNotMatch(p, /Transcribe/i);
});

test("buildLanguagePrompt for mg alone uses Malagasy seed", () => {
  const p = buildLanguagePrompt(["mg"], undefined);
  assert.ok(p);
  assert.match(p, /Manao ahoana|Misaotra/i);
  assert.doesNotMatch(p, /Never output French/i);
});

test("dictionaryTermsForHints only when mg present", () => {
  assert.equal(dictionaryTermsForHints(["fr"]), undefined);
  const terms = dictionaryTermsForHints(["mg", "fr"]);
  assert.ok(terms?.includes("Misaotra"));
  assert.ok(terms?.includes("Terra Nova"));
});
