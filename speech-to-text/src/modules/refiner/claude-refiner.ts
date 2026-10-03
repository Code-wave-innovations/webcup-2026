import Anthropic from "@anthropic-ai/sdk";
import type { TranscriptSegment } from "../stt/types.js";

export const CLAUDE_REFINER_MODEL = "claude-sonnet-4-5-20250929";

/** System prompt rules — text-only refinement; Claude never receives audio. */
export const REFINER_SYSTEM_PROMPT = `You refine automatic speech recognition (ASR) transcripts. You receive text only, never audio.

Rules (follow strictly):
1. Do not translate meaning across languages unless repairing an ASR language mis-detection (see rules 6–8).
2. Do not invent facts or topics that are not phonetically implied by the ASR text.
3. Fix obvious ASR errors, punctuation, and casing where appropriate.
4. Preserve intentional code-switching only when languageHints lists multiple languages.
5. Prefer dictionary spellings when phonetically plausible (use dictionaryTerms heavily).
6. Use languageHints: if a word is clearly not in any hinted language and has an obvious phonetic correction in a hinted language, replace it with that correction.
7. When languageHints includes "mg": Whisper often hallucinates French/English. Treat those as mis-hearings and rewrite into the closest Malagasy using dictionaryTerms and phonetics. Keeping wrong French/English is worse than a phonetic Malagasy repair.
8. When languageHints is ONLY ["mg"]: the entire transcript must be Malagasy (plus Terra Nova proper nouns). Strip or replace every French/English word that is not in dictionaryTerms. Do not leave conversational French.

Output: reply with a single JSON object only (no markdown fences), shape:
{"text":"<full refined transcript>","segments":[{"startMs":number,"endMs":number,"text":"string","confidence?":number,"speakerId?":string,"language?":string}]}

Keep segment startMs/endMs unchanged unless a boundary is clearly wrong. Refine segment text to align with the full transcript.`;

export interface RefineInput {
  text: string;
  segments: TranscriptSegment[];
  languageHints?: string[];
  context?: { domain?: string; keywords?: string[] };
  dictionaryTerms?: string[];
}

export interface RefineResult {
  text: string;
  segments: TranscriptSegment[];
}

export class ClaudeRefinerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClaudeRefinerError";
  }
}

export type ClaudeRefinerClient = Pick<Anthropic, "messages">;

export interface ClaudeRefinerDeps {
  client?: ClaudeRefinerClient;
  model?: string;
}

export function buildRefinerUserMessage(input: RefineInput): string {
  const payload = {
    transcript: input.text,
    segments: input.segments,
    languageHints: input.languageHints,
    context: input.context,
    dictionaryTerms: input.dictionaryTerms,
  };
  return `Refine this ASR transcript:\n${JSON.stringify(payload, null, 2)}`;
}

/** Parses Claude JSON output into {@link RefineResult}. Exported for unit tests. */
export function parseRefinerResponse(raw: string): RefineResult {
  const trimmed = raw.trim();
  const jsonText =
    trimmed.startsWith("```") ?
      trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim()
    : trimmed;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new ClaudeRefinerError("Claude refiner returned invalid JSON");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new ClaudeRefinerError("Claude refiner JSON must be an object");
  }

  const obj = parsed as Record<string, unknown>;
  if (typeof obj.text !== "string") {
    throw new ClaudeRefinerError('Claude refiner JSON missing string field "text"');
  }
  if (!Array.isArray(obj.segments)) {
    throw new ClaudeRefinerError('Claude refiner JSON missing array field "segments"');
  }

  const segments: TranscriptSegment[] = obj.segments.map((seg, index) => {
    if (typeof seg !== "object" || seg === null) {
      throw new ClaudeRefinerError(`Invalid segment at index ${index}`);
    }
    const s = seg as Record<string, unknown>;
    if (
      typeof s.startMs !== "number" ||
      typeof s.endMs !== "number" ||
      typeof s.text !== "string"
    ) {
      throw new ClaudeRefinerError(`Segment at index ${index} missing startMs, endMs, or text`);
    }
    const out: TranscriptSegment = {
      startMs: s.startMs,
      endMs: s.endMs,
      text: s.text,
    };
    if (typeof s.confidence === "number") out.confidence = s.confidence;
    if (typeof s.speakerId === "string") out.speakerId = s.speakerId;
    if (typeof s.language === "string") out.language = s.language;
    return out;
  });

  return { text: obj.text.trim(), segments };
}

function extractTextFromMessage(message: Anthropic.Message): string {
  const parts = message.content.filter(
    (block): block is Anthropic.TextBlock => block.type === "text",
  );
  if (!parts.length) {
    throw new ClaudeRefinerError("Claude refiner returned no text content");
  }
  return parts.map((p) => p.text).join("");
}

export function createClaudeRefiner(
  apiKey: string,
  deps: ClaudeRefinerDeps = {},
): { refineTranscript: (input: RefineInput) => Promise<RefineResult> } {
  const client = deps.client ?? new Anthropic({ apiKey });
  const model = deps.model ?? CLAUDE_REFINER_MODEL;

  async function refineTranscript(input: RefineInput): Promise<RefineResult> {
    const message = await client.messages.create({
      model,
      max_tokens: 8192,
      system: REFINER_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildRefinerUserMessage(input) }],
    });

    const rawText = extractTextFromMessage(message);
    return parseRefinerResponse(rawText);
  }

  return { refineTranscript };
}
