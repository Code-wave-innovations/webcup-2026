import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Default max duration (seconds); matches config schema default. */
export const DEFAULT_MAX_AUDIO_DURATION_SEC = 7200;

export type AudioPreprocessErrorCode = "AUDIO_TOO_LARGE";

export class AudioPreprocessError extends Error {
  readonly code: AudioPreprocessErrorCode;

  constructor(code: AudioPreprocessErrorCode, message: string) {
    super(message);
    this.name = "AudioPreprocessError";
    this.code = code;
  }
}

export function isAudioPreprocessError(
  err: unknown,
): err is AudioPreprocessError {
  return err instanceof AudioPreprocessError;
}

async function probeDurationSec(inputPath: string): Promise<number> {
  const { stdout } = await execFileAsync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      inputPath,
    ],
    { encoding: "utf8" },
  );
  const durationSec = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(durationSec) || durationSec < 0) {
    throw new Error(`ffprobe returned invalid duration for ${inputPath}`);
  }
  return durationSec;
}

export async function preprocessAudio(
  inputPath: string,
  workDir: string,
  maxDurationSec: number = DEFAULT_MAX_AUDIO_DURATION_SEC,
): Promise<{ pcmPath: string; durationSec: number }> {
  const durationSec = await probeDurationSec(inputPath);

  if (durationSec > maxDurationSec) {
    throw new AudioPreprocessError(
      "AUDIO_TOO_LARGE",
      `Audio duration ${durationSec}s exceeds limit ${maxDurationSec}s`,
    );
  }

  await fs.mkdir(workDir, { recursive: true });
  const pcmPath = path.join(workDir, "output.pcm");

  await execFileAsync("ffmpeg", [
    "-y",
    "-i",
    inputPath,
    "-ac",
    "1",
    "-ar",
    "16000",
    "-f",
    "s16le",
    pcmPath,
  ]);

  return { pcmPath, durationSec };
}
