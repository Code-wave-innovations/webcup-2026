export interface MetricFields {
  jobId?: string;
  latencyMs?: number;
  provider?: string;
  [key: string]: unknown;
}

export type MetricSink = (line: string) => void;

let sink: MetricSink = (line) => console.log(line);

/** Override the output sink (tests). Returns a restore function. */
export function setMetricSink(next: MetricSink): () => void {
  const prev = sink;
  sink = next;
  return () => {
    sink = prev;
  };
}

/** Emits one structured JSON log line. */
export function logMetric(event: string, fields: MetricFields = {}): void {
  sink(
    JSON.stringify({
      ts: new Date().toISOString(),
      event,
      ...fields,
    }),
  );
}
