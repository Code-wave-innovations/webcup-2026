import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export interface SpeechCache {
  get(key: string): Promise<Buffer | null>;
  set(key: string, audio: Buffer): Promise<void>;
}

export function speechCacheKey(voice: string, text: string): string {
  return createHash("sha256").update(`${voice}\n${text}`).digest("hex");
}

/**
 * Recordings kept on disk (the `tmp` volume in production): Nova's fixed lines are generated once,
 * then served instantly and for free.
 */
export function createDiskSpeechCache(dir: string): SpeechCache {
  const file = (key: string) => path.join(dir, `${key}.mp3`);
  return {
    async get(key) {
      return fs.readFile(file(key)).catch(() => null);
    },
    async set(key, audio) {
      await fs.mkdir(dir, { recursive: true });
      // written then renamed: a reader never sees half a file
      const temp = `${file(key)}.${process.pid}.tmp`;
      await fs.writeFile(temp, audio);
      await fs.rename(temp, file(key));
    },
  };
}

/** A sliding one-minute budget of generated characters, to protect the provider's credits. */
export function createCharBudget(perMinute: number, now = () => Date.now()) {
  const spent: Array<{ at: number; chars: number }> = [];
  return {
    take(chars: number): boolean {
      const since = now() - 60_000;
      while (spent.length && spent[0]!.at <= since) spent.shift();
      const used = spent.reduce((sum, entry) => sum + entry.chars, 0);
      if (used + chars > perMinute) return false;
      spent.push({ at: now(), chars });
      return true;
    },
  };
}
