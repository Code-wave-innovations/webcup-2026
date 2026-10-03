export type ShouldRefineReason =
  | "empty"
  | "malagasy_hint"
  | "low_confidence"
  | "high_confidence"
  | "short_clean"
  | "script_mismatch"
  | "noisy_text"
  | "default_ok";

export interface ShouldRefineInput {
  text: string;
  confidence?: number;
  languageHints?: string[];
  threshold?: number;
}

export interface ShouldRefineDecision {
  refine: boolean;
  reason: ShouldRefineReason;
}

const DEFAULT_THRESHOLD = 0.55;

const LATIN_HINTS = new Set(["fr", "en", "mg", "es", "de", "it", "pt", "ht", "sw"]);

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function isCleanShort(text: string): boolean {
  return wordCount(text) <= 3 && /^[\p{L}\p{M}\s.,!?'’-]+$/u.test(text.trim());
}

function hasScriptMismatch(text: string, languageHints?: string[]): boolean {
  if (!languageHints?.length) return false;
  const hints = languageHints.map((h) => h.toLowerCase());
  const expectLatin = hints.every((h) => LATIN_HINTS.has(h));
  if (!expectLatin) return false;
  // Cyrillic, CJK, Arabic letters while hints are Latin-script languages
  return /[\u0400-\u04FF\u0600-\u06FF\u3040-\u30FF\u4E00-\u9FFF]/.test(text);
}

function isNoisy(text: string): boolean {
  const t = text.trim();
  if (/(.)\1{5,}/.test(t)) return true;
  const letters = (t.match(/\p{L}/gu) ?? []).length;
  const nonLetters = t.replace(/\s/g, "").length - letters;
  if (t.replace(/\s/g, "").length > 0 && nonLetters / t.replace(/\s/g, "").length > 0.35) {
    return true;
  }
  const tokens = t.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length >= 4) {
    const counts = new Map<string, number>();
    for (const tok of tokens) counts.set(tok, (counts.get(tok) ?? 0) + 1);
    for (const n of counts.values()) if (n >= 4) return true;
  }
  return false;
}

export function shouldRefine(input: ShouldRefineInput): ShouldRefineDecision {
  const text = input.text.trim();
  const threshold = input.threshold ?? DEFAULT_THRESHOLD;

  if (!text) return { refine: false, reason: "empty" };

  // Whisper has no strong Malagasy support: always let Claude repair when mg is expected.
  if ((input.languageHints ?? []).some((h) => h.toLowerCase() === "mg")) {
    return { refine: true, reason: "malagasy_hint" };
  }

  if (hasScriptMismatch(text, input.languageHints)) {
    return { refine: true, reason: "script_mismatch" };
  }

  if (typeof input.confidence === "number") {
    if (input.confidence < threshold) {
      return { refine: true, reason: "low_confidence" };
    }
    return { refine: false, reason: "high_confidence" };
  }

  if (isCleanShort(text)) return { refine: true, reason: "short_clean" };
  if (isNoisy(text)) return { refine: true, reason: "noisy_text" };
  return { refine: false, reason: "default_ok" };
}
