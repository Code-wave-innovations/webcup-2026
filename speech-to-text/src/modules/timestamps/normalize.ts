import type { TranscriptSegment } from "../stt/types.js";

/**
 * Normalizes segments: drops empty ones, clamps to non-negative integers,
 * ensures endMs >= startMs, sorts by start, and removes overlaps by pushing
 * each segment's start to the previous end.
 */
export function normalizeSegments(
  segments: TranscriptSegment[],
): TranscriptSegment[] {
  const cleaned = segments
    .filter((s) => s.text.trim().length > 0)
    .map((s) => {
      const startMs = Math.max(0, Math.round(Number.isFinite(s.startMs) ? s.startMs : 0));
      const endRaw = Math.max(0, Math.round(Number.isFinite(s.endMs) ? s.endMs : 0));
      return { ...s, text: s.text.trim(), startMs, endMs: Math.max(startMs, endRaw) };
    })
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);

  let prevEnd = 0;
  return cleaned.map((s) => {
    const startMs = Math.max(s.startMs, prevEnd);
    const endMs = Math.max(s.endMs, startMs);
    prevEnd = endMs;
    return { ...s, startMs, endMs };
  });
}
