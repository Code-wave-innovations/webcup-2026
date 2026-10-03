/**
 * Terra Nova + everyday Malagasy vocabulary for STT prompts and Claude refine.
 * Prefer MG spellings; keep a few city proper nouns that appear in speech as-is.
 */
export const MALAGASY_CORE_GLOSSARY: string[] = [
  "Manao ahoana",
  "Salama",
  "Misaotra",
  "Azafady",
  "Eny",
  "Tsia",
  "Inona",
  "Aiza",
  "Oviana",
  "Ahoana",
  "Mba",
  "Izy",
  "Izaho",
  "Ianareo",
  "Isika",
  "Tsy",
  "Misy",
  "Tia",
  "Tianao",
  "Mandeha",
  "Avy",
  "Ho",
  "Any",
  "Eto",
  "Ao",
  "Anio",
  "Rahampitso",
  "Omaly",
  "Rano",
  "Vary",
  "Trano",
  "Lalana",
  "Fiara",
  "Olona",
  "Zaza",
  "Ray",
  "Reny",
  "Namana",
  "Asa",
  "Volana",
  "Herinaratra",
  "Fifandraisana",
  "Vaovao",
  "Olana",
  "Fanampiana",
  "Serivisy",
  "Tanàna",
  "Foibe",
  "Mponina",
  "Fanompoana",
];

export const TERRA_NOVA_PROPER_NOUNS: string[] = [
  "Terra Nova",
  "Haut Conseil",
];

/** Full list passed to Claude when mg is hinted. */
export const TERRA_NOVA_GLOSSARY: string[] = [
  ...TERRA_NOVA_PROPER_NOUNS,
  ...MALAGASY_CORE_GLOSSARY,
];

/** Example lines Whisper can latch onto as orthography bias (mg-only). */
export const MALAGASY_PROMPT_SEED =
  "Manao ahoana. Misaotra betsaka. Azafady aiza ny foibe. Misy olana ny rano sy herinaratra. " +
  "Mba omeo vaovao momba Terra Nova. Te-handeha any amin'ny serivisy aho.";

export function hintsIncludeMalagasy(languageHints?: string[]): boolean {
  return (languageHints ?? []).some((h) => h.toLowerCase() === "mg");
}

export function isMalagasyOnly(languageHints?: string[]): boolean {
  const hints = (languageHints ?? []).map((h) => h.toLowerCase());
  return hints.length === 1 && hints[0] === "mg";
}

/** Extra STT prompt bias when Malagasy may be spoken — Whisper-style seeds only. */
export function malagasySttGuidance(languageHints?: string[]): string {
  if (isMalagasyOnly(languageHints)) {
    return `${MALAGASY_PROMPT_SEED} Lexique: ${MALAGASY_CORE_GLOSSARY.slice(0, 24).join(", ")}.`;
  }
  return `Malagasy: ${MALAGASY_PROMPT_SEED}`;
}

export function mergePromptContext(
  languageHints: string[] | undefined,
  promptContext: string | undefined,
): string | undefined {
  const parts: string[] = [];
  if (hintsIncludeMalagasy(languageHints)) {
    parts.push(malagasySttGuidance(languageHints));
  }
  if (promptContext) parts.push(promptContext);
  return parts.length ? parts.join(" ") : undefined;
}

export function dictionaryTermsForHints(languageHints?: string[]): string[] | undefined {
  if (!hintsIncludeMalagasy(languageHints)) return undefined;
  return [...TERRA_NOVA_GLOSSARY];
}
