export type HashTaskType = "file" | "chunk";
export type HashExecMode = "worker" | "main";

export interface HashPerfRecord {
  taskType: HashTaskType;
  mode: HashExecMode;
  bytes: number;
  durationMs: number;
  throughputMbps: number;
  timestamp: number;
}

export interface HashPerfSummary {
  mode: HashExecMode;
  count: number;
  totalBytes: number;
  totalDurationMs: number;
  avgDurationMs: number;
  p95DurationMs: number;
  avgThroughputMbps: number;
}

const hashPerfRecords: HashPerfRecord[] = [];
const MAX_RECORDS = 500;

const percentile = (sortedValues: number[], ratio: number): number => {
  if (!sortedValues.length) return 0;
  const index = Math.min(sortedValues.length - 1, Math.max(0, Math.ceil(sortedValues.length * ratio) - 1));
  return sortedValues[index];
};

const calcThroughputMbps = (bytes: number, durationMs: number): number => {
  if (durationMs <= 0) return 0;
  const megaBytes = bytes / (1024 * 1024);
  return megaBytes / (durationMs / 1000);
};

export const recordHashPerf = (record: Omit<HashPerfRecord, "throughputMbps" | "timestamp">) => {
  const normalized: HashPerfRecord = {
    ...record,
    throughputMbps: calcThroughputMbps(record.bytes, record.durationMs),
    timestamp: Date.now()
  };

  hashPerfRecords.push(normalized);
  if (hashPerfRecords.length > MAX_RECORDS) {
    hashPerfRecords.splice(0, hashPerfRecords.length - MAX_RECORDS);
  }
};

export const getHashPerfSummary = (mode: HashExecMode): HashPerfSummary => {
  const list = hashPerfRecords.filter((item) => item.mode === mode);
  const durations = list.map((item) => item.durationMs).sort((a, b) => a - b);
  const totalBytes = list.reduce((sum, item) => sum + item.bytes, 0);
  const totalDurationMs = list.reduce((sum, item) => sum + item.durationMs, 0);
  const avgDurationMs = list.length ? totalDurationMs / list.length : 0;
  const avgThroughputMbps = list.length
    ? list.reduce((sum, item) => sum + item.throughputMbps, 0) / list.length
    : 0;

  return {
    mode,
    count: list.length,
    totalBytes,
    totalDurationMs,
    avgDurationMs,
    p95DurationMs: percentile(durations, 0.95),
    avgThroughputMbps
  };
};

export const getHashPerfComparison = () => {
  const worker = getHashPerfSummary("worker");
  const main = getHashPerfSummary("main");

  const durationReductionPct = main.avgDurationMs > 0
    ? ((main.avgDurationMs - worker.avgDurationMs) / main.avgDurationMs) * 100
    : 0;

  const throughputGainPct = main.avgThroughputMbps > 0
    ? ((worker.avgThroughputMbps - main.avgThroughputMbps) / main.avgThroughputMbps) * 100
    : 0;

  const p95ReductionPct = main.p95DurationMs > 0
    ? ((main.p95DurationMs - worker.p95DurationMs) / main.p95DurationMs) * 100
    : 0;

  return {
    worker,
    main,
    durationReductionPct,
    throughputGainPct,
    p95ReductionPct
  };
};

export const printHashPerfComparison = () => {
  const result = getHashPerfComparison();
  console.group("[Hash性能对比]");
  console.table([result.main, result.worker]);
  console.table([{
    durationReductionPct: Number(result.durationReductionPct.toFixed(2)),
    throughputGainPct: Number(result.throughputGainPct.toFixed(2)),
    p95ReductionPct: Number(result.p95ReductionPct.toFixed(2))
  }]);
  console.groupEnd();
};

declare global {
  interface Window {
    __HASH_PERF__?: {
      getHashPerfComparison: typeof getHashPerfComparison;
      getHashPerfSummary: typeof getHashPerfSummary;
      printHashPerfComparison: typeof printHashPerfComparison;
      records: HashPerfRecord[];
    };
  }
}

if (typeof window !== "undefined") {
  window.__HASH_PERF__ = {
    getHashPerfComparison,
    getHashPerfSummary,
    printHashPerfComparison,
    records: hashPerfRecords
  };
}
