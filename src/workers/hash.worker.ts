/// <reference lib="webworker" />
import SparkMD5 from "spark-md5";

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

const md5OfBlob = async (blob: Blob): Promise<string> => {
  const buffer = await blob.arrayBuffer();
  const hasher = new SparkMD5.ArrayBuffer();
  hasher.append(buffer);
  return hasher.end();
};

const md5OfFile = async (file: File, chunkSize = 2 * 1024 * 1024): Promise<string> => {
  const hasher = new SparkMD5.ArrayBuffer();
  for (let offset = 0; offset < file.size; offset += chunkSize) {
    const slice = file.slice(offset, Math.min(offset + chunkSize, file.size));
    const buffer = await slice.arrayBuffer();
    hasher.append(buffer);
  }
  return hasher.end();
};

self.addEventListener("message", async (event: MessageEvent<HashWorkerRequest>) => {
  const { id, type, payload, chunkSize } = event.data;
  const start = performance.now();

  try {
    const hash = type === "blob"
      ? await md5OfBlob(payload as Blob)
      : await md5OfFile(payload as File, chunkSize);

    const response: HashWorkerResponse = {
      id,
      ok: true,
      hash,
      durationMs: performance.now() - start,
      bytes: payload.size
    };
    self.postMessage(response);
  } catch (error) {
    const response: HashWorkerResponse = {
      id,
      ok: false,
      error: error instanceof Error ? error.message : "Hash worker error"
    };
    self.postMessage(response);
  }
});
