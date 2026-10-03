/** ISO 639-1 code → English name (for logs / Claude only — not Whisper prompt text). */
const LANGUAGE_NAMES: Record<string, string> = {
  fr: "French",
  en: "English",
  mg: "Malagasy",
  es: "Spanish",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  sw: "Swahili",
  ar: "Arabic",
  ht: "Haitian Creole",
};

/**
 * Codes accepted by Whisper-compatible transcription `language`.
 * Others (e.g. `mg`) must be guided via the prompt only.
 */
const WHISPER_LANGUAGE_PARAM_CODES = new Set([
  "fr",
  "en",
  "es",
  "de",
  "it",
  "pt",
  "sw",
  "ar",
  "ht",
]);

/**
 * Whisper `prompt` must look like prior transcript in the same language —
 * NOT English system instructions (those cause greeting hallucinations).
 */
const WHISPER_PROMPT_SEEDS: Record<string, string> = {
  fr: "Bonjour. Merci beaucoup. Oui, d'accord. Comment allez-vous ?",
  en: "Hello. Thank you. Yes, okay. How are you?",
  mg: "Manao ahoana. Misaotra betsaka. Eny. Azafady.",
  es: "Hola. Muchas gracias. Sí, de acuerdo.",
  de: "Guten Tag. Vielen Dank. Ja, in Ordnung.",
  it: "Buongiorno. Grazie mille. Sì, d'accordo.",
  pt: "Olá. Muito obrigado. Sim, tudo bem.",
};

function languageName(code: string): string {
  return LANGUAGE_NAMES[code.toLowerCase()] ?? code;
}

/** Single hint → API `language` only when Whisper recognizes the code. */
export function resolveApiLanguage(
  languageHints: string[] | undefined,
): string | undefined {
  if (languageHints?.length !== 1) return undefined;
  const code = languageHints[0].toLowerCase();
  return WHISPER_LANGUAGE_PARAM_CODES.has(code) ? code : undefined;
}

/**
 * Builds the Whisper continuation prompt from expected languages.
 * Uses target-language example phrases only (Whisper style priming).
 */
export function buildLanguagePrompt(
  languageHints: string[] | undefined,
  promptContext: string | undefined,
): string | undefined {
  const parts: string[] = [];
  if (languageHints?.length) {
    const seeds = languageHints
      .map((h) => WHISPER_PROMPT_SEEDS[h.toLowerCase()])
      .filter((s): s is string => Boolean(s));
    if (seeds.length) {
      // Prefer the first hint's seed; append others lightly for code-switch.
      parts.push(seeds[0]);
      if (seeds.length > 1) parts.push(seeds.slice(1).join(" "));
    } else {
      parts.push(`The speech is in ${languageHints.map(languageName).join(", ")}.`);
    }
  }
  // Extra context only if it looks like vocabulary (not English meta-instructions).
  if (promptContext && !/transcribe|do not|never output|orthography/i.test(promptContext)) {
    parts.push(promptContext);
  }
  return parts.length ? parts.join(" ") : undefined;
}

export function audioFormatFromPath(audioPath: string): string {
  const ext = audioPath.split(".").pop()?.toLowerCase() ?? "wav";
  if (ext === "mpeg") return "mp3";
  return ext;
}
