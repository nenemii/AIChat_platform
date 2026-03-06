import { create } from "zustand";
import { md5OfFileWithWorkerFallback } from "../utils/hashWorkerClient";
import { printHashPerfComparison, recordHashPerf } from "../utils/hashPerfMetrics";

let hashPerfCounter = 0;

export interface Chunk {
  index: number;
  size: number;
  status: "pending" | "uploading" | "success" | "error";
  progress: number;
}

interface FileUpload {
  id: string;
  fileId: string;
  name: string;
  size: number;
  totalChunks: number;
  chunks: Chunk[];
  totalProgress: number;
  status: "pending" | "uploading" | "completed" | "error";
  url?: string;
}

interface FileStore {
  files: FileUpload[];
  addFile: (file: File) => Promise<string>; // 返回fileId
  updateChunkProgress: (fileId: string, chunkIndex: number, progress: number) => void;
  updateChunkStatus: (fileId: string, chunkIndex: number, status: Chunk["status"]) => void;
  updateFileStatus: (fileId: string, status: FileUpload["status"]) => void;
  calculateTotalProgress: (fileId: string) => void;
  clearFile: (fileId: string) => void;
  setFileUrl: (fileId: string, url: string) => void;
}

export const useFileStore = create<FileStore>((set, get) => ({
  files: [],

  addFile: async (file: File) => {
    const CHUNK_SIZE = 1024 * 1024; // 1MB/分片
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    console.log(`[FileStore] 初始化文件: ${file.name}, 总分片: ${totalChunks}`);

    console.log(`[FileStore] 开始计算文件MD5: ${file.name}`);
    const hashStart = performance.now();
    const fileHashResult = await md5OfFileWithWorkerFallback(file);
    const hashDurationMs = performance.now() - hashStart;
    const fileMd5 = fileHashResult.hash;
    recordHashPerf({
      taskType: "file",
      mode: fileHashResult.mode,
      bytes: file.size,
      durationMs: hashDurationMs
    });
    hashPerfCounter += 1;
    if (hashPerfCounter % 20 === 0) {
      printHashPerfComparison();
    }
    console.log(`[FileStore] 文件MD5计算完成: ${file.name}, md5=${fileMd5}`);

    try {
      const res = await fetch("http://localhost:3001/api/upload/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, fileSize: file.size, totalChunks, fileMd5 })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(`初始化失败: ${error.error}`);
      }

      const { fileId, uploadedChunks } = await res.json();
      console.log(`[FileStore] 后端返回fileId: ${fileId}`);

      const chunks: Chunk[] = Array.from({ length: totalChunks }, (_, i) => ({
        index: i,
        size: Math.min(CHUNK_SIZE, file.size - i * CHUNK_SIZE),
        status: uploadedChunks.includes(i) ? "success" : "pending",
        progress: uploadedChunks.includes(i) ? 100 : 0
      }));

      set((state) => ({
        files: [...state.files, {
          id: crypto.randomUUID(),
          fileId,
          name: file.name,
          size: file.size,
          totalChunks,
          chunks,
          totalProgress: (uploadedChunks.length / totalChunks) * 100,
          status: "pending"
        }]
      }));

      return fileId; // 返回fileId供后续使用
    } catch (err) {
      console.error(`[FileStore] 初始化失败:`, err);
      throw err;
    }
  },

  updateChunkProgress: (fileId, chunkIndex, progress) => {
    set((state) => ({
      files: state.files.map(file =>
        file.fileId === fileId
          ? { ...file, chunks: file.chunks.map(c =>
              c.index === chunkIndex ? { ...c, progress } : c
            )}
          : file
      )
    }));
    get().calculateTotalProgress(fileId);
  },

  updateChunkStatus: (fileId, chunkIndex, status) => {
    set((state) => ({
      files: state.files.map(file =>
        file.fileId === fileId
          ? { ...file, chunks: file.chunks.map(c =>
              c.index === chunkIndex ? { ...c, status } : c
            )}
          : file
      )
    }));
    get().calculateTotalProgress(fileId);
  },

  updateFileStatus: (fileId, status) => {
    set((state) => ({
      files: state.files.map(file =>
        file.fileId === fileId ? { ...file, status } : file
      )
    }));
  },

  calculateTotalProgress: (fileId) => {
    const file = get().files.find(f => f.fileId === fileId);
    if (!file) return;
    const completed = file.chunks.filter(c => c.status === "success").length;
    const progress = Math.round((completed / file.totalChunks) * 100);
    set((state) => ({
      files: state.files.map(f =>
        f.fileId === fileId ? { ...f, totalProgress: progress } : f
      )
    }));
  },

  clearFile: (fileId) => {
    set((state) => ({ files: state.files.filter(f => f.fileId !== fileId) }));
  },

  setFileUrl: (fileId, url) => {
    set((state) => ({
      files: state.files.map(f =>
        f.fileId === fileId ? { ...f, url } : f
      )
    }));
  }
}));