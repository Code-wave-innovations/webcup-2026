export interface SttProvider {
  readonly name: string;
  transcribe(input: SttInput): Promise<SttResult>;
}

export interface SttInput {
  audioPath: string;
  languageHints?: string[];
  promptContext?: string;
  timestamps?: boolean;
}

export interface SttResult {
  text: string;
  language?: string;
  confidence?: number;
  segments: TranscriptSegment[];
  raw?: unknown;
  latencyMs: number;
  costUsdEstimate?: number;
}

export interface TranscriptSegment {
  startMs: number;
  endMs: number;
  text: string;
  confidence?: number;
  speakerId?: string;
  language?: string;
}
