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

export async function probeDurationSec(inputPath: string): Promise<number> {
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

/** Wraps raw s16le 16kHz mono PCM in a WAV container (needed by container-only STT providers). */
export async function pcmToWav(
  pcmPath: string,
  wavPath: string = pcmPath.replace(/\.pcm$/i, "") + ".wav",
): Promise<string> {
  await execFileAsync("ffmpeg", [
    "-y",
    "-f",
    "s16le",
    "-ar",
    "16000",
    "-ac",
    "1",
    "-i",
    pcmPath,
    wavPath,
  ]);
  return wavPath;
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

  // Denoise: cut rumble below speech band, then FFT-based noise reduction.
  // Keeps the STT from transcribing background hum/hiss as phantom words.
  await execFileAsync("ffmpeg", [
    "-y",
    "-i",
    inputPath,
    "-ac",
    "1",
    "-ar",
    "16000",
    "-af",
    "highpass=f=80,afftdn=nf=-25",
    "-f",
    "s16le",
    pcmPath,
  ]);

  return { pcmPath, durationSec };
}

/**
 * Measures speech energy over raw s16le PCM. Returns the fraction of 20 ms
 * frames whose RMS exceeds the threshold, plus the longest continuous
 * speech run in ms. Used to reject chunks that contain no speech at all
 * (silence/background noise) before they reach the STT provider, which
 * would otherwise hallucinate text on them.
 */
export function analyzeSpeechEnergy(
  pcm: Buffer,
  options: { threshold?: number; frameMs?: number } = {},
): { speechRatio: number; longestSpeechMs: number } {
  const threshold = options.threshold ?? 0.015;
  const frameMs = options.frameMs ?? 20;
  const frameSamples = Math.max(1, Math.round((16000 * frameMs) / 1000));
  const frames = Math.floor(pcm.length / 2 / frameSamples);
  if (frames === 0) return { speechRatio: 0, longestSpeechMs: 0 };

  let speechFrames = 0;
  let longestRun = 0;
  let currentRun = 0;
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    const base = f * frameSamples * 2;
    for (let i = 0; i < frameSamples; i++) {
      const sample = pcm.readInt16LE(base + i * 2) / 32768;
      sum += sample * sample;
    }
    if (Math.sqrt(sum / frameSamples) >= threshold) {
      speechFrames++;
      currentRun++;
      if (currentRun > longestRun) longestRun = currentRun;
    } else {
      currentRun = 0;
    }
  }

  return {
    speechRatio: speechFrames / frames,
    longestSpeechMs: longestRun * frameMs,
  };
}

/**
 * Decodes any container audio (webm/opus, wav, …) to raw s16le 16 kHz mono
 * PCM with light denoising, for energy analysis of realtime chunks.
 */
export async function decodeToPcm(
  inputPath: string,
  pcmPath: string,
): Promise<void> {
  await execFileAsync("ffmpeg", [
    "-y",
    "-i",
    inputPath,
    "-ac",
    "1",
    "-ar",
    "16000",
    "-af",
    "highpass=f=80,afftdn=nf=-25",
    "-f",
    "s16le",
    pcmPath,
  ]);
}