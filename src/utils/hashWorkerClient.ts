import { md5OfBlob, md5OfFile } from "./md5";

type HashWorkerMode = "auto" | "worker" | "main";

type HashWorkerRequest = {
  id: string;
  type: "blob" | "file";
  payload: Blob | File;
  chunkSize?: number;
};

type HashWorkerResponse = {
  id: string;
  ok: boolean;
  hash?: string;
  durationMs?: number;
  bytes?: number;
  error?: string;
};

type PendingTask = {
  resolve: (value: HashWorkerResponse) => void;
  reject: (reason?: unknown) => void;
};

const HASH_MODE_KEY = "HASH_MODE";
let hashWorker: Worker | null = null;
let workerUnavailable = false;
const pendingTasks = new Map<string, PendingTask>();

const supportsWorker = (): boolean => {
  return typeof Worker !== "undefined";
};

const getWorker = (): Worker => {
  if (!supportsWorker() || workerUnavailable) {
    throw new Error("Hash worker unavailable");
  }

  if (hashWorker) {
    return hashWorker;
  }

  hashWorker = new Worker(new URL("../workers/hash.worker.ts", import.meta.url), { type: "module" });

  hashWorker.onmessage = (event: MessageEvent<HashWorkerResponse>) => {
    const { id } = event.data;
    const task = pendingTasks.get(id);
    if (!task) return;
    pendingTasks.delete(id);
    task.resolve(event.data);
  };

  hashWorker.onerror = (event) => {
    const errorMessage = event.message || "Hash worker runtime error";
    pendingTasks.forEach((task) => task.reject(new Error(errorMessage)));
    pendingTasks.clear();
    hashWorker?.terminate();
    hashWorker = null;
    workerUnavailable = true;
  };

  return hashWorker;
};

const runHashInWorker = (request: Omit<HashWorkerRequest, "id">): Promise<HashWorkerResponse> => {
  const worker = getWorker();
  const id = crypto.randomUUID();
  const workerRequest: HashWorkerRequest = { id, ...request };

  return new Promise<HashWorkerResponse>((resolve, reject) => {
    pendingTasks.set(id, { resolve, reject });
    worker.postMessage(workerRequest);
  });
};

export const getHashWorkerMode = (): HashWorkerMode => {
  if (typeof window === "undefined") return "auto";
  const mode = window.localStorage.getItem(HASH_MODE_KEY);
  if (mode === "worker" || mode === "main") return mode;
  return "auto";
};

export const md5OfBlobWithWorkerFallback = async (blob: Blob): Promise<{ hash: string; mode: "worker" | "main" }> => {
  const mode = getHashWorkerMode();

  if (mode !== "main") {
    try {
      const result = await runHashInWorker({ type: "blob", payload: blob });
      if (result.ok && result.hash) {
        return { hash: result.hash, mode: "worker" };
      }
      throw new Error(result.error || "Hash worker failed");
    } catch {
      if (mode === "worker") {
        throw new Error("HASH_MODE=worker 但 Worker 不可用");
      }
    }
  }

  return {
    hash: await md5OfBlob(blob),
    mode: "main"
  };
};

export const md5OfFileWithWorkerFallback = async (
  file: File,
  chunkSize = 2 * 1024 * 1024
): Promise<{ hash: string; mode: "worker" | "main" }> => {
  const mode = getHashWorkerMode();

  if (mode !== "main") {
    try {
      const result = await runHashInWorker({ type: "file", payload: file, chunkSize });
      if (result.ok && result.hash) {
        return { hash: result.hash, mode: "worker" };
      }
      throw new Error(result.error || "Hash worker failed");
    } catch {
      if (mode === "worker") {
        throw new Error("HASH_MODE=worker 但 Worker 不可用");
      }
    }
  }

  return {
    hash: await md5OfFile(file, chunkSize),
    mode: "main"
  };
};
