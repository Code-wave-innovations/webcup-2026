import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { test } from "node:test";
import {
  AudioPreprocessError,
  analyzeSpeechEnergy,
  preprocessAudio,
} from "../src/modules/audio/preprocess.js";

const execFileAsync = promisify(execFile);

const fixturePath = path.join(
  import.meta.dirname,
  "fixtures",
  "silence.wav",
);

async function ffmpegAvailable(): Promise<boolean> {
  try {
    await execFileAsync("ffmpeg", ["-version"]);
    await execFileAsync("ffprobe", ["-version"]);
    return true;
  } catch {
    return false;
  }
}

test("preprocessAudio converts fixture WAV to PCM 16kHz mono", async (t) => {
  if (!(await ffmpegAvailable())) {
    t.skip("ffmpeg/ffprobe not available");
    return;
  }

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "stt-audio-"));
  try {
    const { pcmPath, durationSec } = await preprocessAudio(
      fixturePath,
      workDir,
    );

    assert.equal(path.basename(pcmPath), "output.pcm");
    assert.ok(durationSec > 0 && durationSec < 2);

    const stat = await fs.stat(pcmPath);
    const expectedBytes = Math.round(durationSec * 16000 * 2);
    assert.ok(
      Math.abs(stat.size - expectedBytes) <= 2,
      `PCM size ${stat.size} vs expected ~${expectedBytes}`,
    );
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
});

test("preprocessAudio rejects duration above max with AUDIO_TOO_LARGE", async (t) => {
  if (!(await ffmpegAvailable())) {
    t.skip("ffmpeg/ffprobe not available");
    return;
  }

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "stt-audio-"));
  try {
    await assert.rejects(
      () => preprocessAudio(fixturePath, workDir, 0.01),
      (err: unknown) => {
        assert.ok(err instanceof AudioPreprocessError);
        assert.equal(err.code, "AUDIO_TOO_LARGE");
        return true;
      },
    );
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
});

test("analyzeSpeechEnergy detects speech vs silence", () => {
  const silence = Buffer.alloc(16000 * 2);
  assert.deepEqual(analyzeSpeechEnergy(silence), { speechRatio: 0, longestSpeechMs: 0 });

  const mixed = Buffer.alloc(16000 * 2);
  for (let i = 0; i < 8000; i++) {
    mixed.writeInt16LE(Math.round(Math.sin(i / 10) * 16000), i * 2);
  }
  const { speechRatio, longestSpeechMs } = analyzeSpeechEnergy(mixed);
  assert.ok(speechRatio > 0.45 && speechRatio < 0.55, `speechRatio=${speechRatio}`);
  assert.ok(longestSpeechMs >= 480, `longestSpeechMs=${longestSpeechMs}`);
});

test("analyzeSpeechEnergy returns zero for empty buffer", () => {
  assert.deepEqual(analyzeSpeechEnergy(Buffer.alloc(0)), { speechRatio: 0, longestSpeechMs: 0 });
});
