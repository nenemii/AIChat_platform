import { useFileStore } from "../store/fileStore";
import type { Chunk } from "../store/fileStore";
import { md5OfBlob } from "../utils/md5";

const CONCURRENT_LIMIT = 3;

const uploadSingleChunk = async (file: File, fileId: string, chunk: Chunk): Promise<boolean> => {
  const { updateChunkProgress, updateChunkStatus } = useFileStore.getState();
  const start = chunk.index * chunk.size;
  const end = Math.min(start + chunk.size, file.size);
  const blob = file.slice(start, end);

  const chunkMd5 = await md5OfBlob(blob);

  console.log(`[uploadSingleChunk] 准备上传分片: fileId=${fileId}, chunkIndex=${chunk.index}`); // 新增日志：确认参数值

  return new Promise<boolean>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "http://localhost:3001/api/upload/chunk");

    // 移除手动设置Content-Type（关键：让浏览器自动处理multipart/form-data）
    // xhr.setRequestHeader("Content-Type", "multipart/form-data"); // 这行必须删除！

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const progress = Math.round((e.loaded / e.total) * 100);
        updateChunkProgress(fileId, chunk.index, progress);
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        const response = JSON.parse(xhr.responseText);
        if (response.success) {
          updateChunkStatus(fileId, chunk.index, "success");
          console.log(`[uploadSingleChunk] 分片${chunk.index}上传成功`);
          resolve(true);
        } else {
          updateChunkStatus(fileId, chunk.index, "error");
          reject(new Error(`分片${chunk.index}上传失败: ${response.error}`));
        }
      } else {
        updateChunkStatus(fileId, chunk.index, "error");
        reject(new Error(`分片${chunk.index}上传失败: 状态码${xhr.status}，原因: ${xhr.statusText}`));
      }
    };

    xhr.onerror = () => {
      updateChunkStatus(fileId, chunk.index, "error");
      reject(new Error(`分片${chunk.index}网络错误`));
    };

    // 构造FormData
    const formData = new FormData();
    
    formData.append("fileId", fileId); // 传递fileId
    formData.append("chunkIndex", chunk.index.toString()); // 传递分片索引
    formData.append("chunkMd5", chunkMd5);
    formData.append("chunk", blob); // 文件分片

    // 新增日志：验证FormData中的参数
    console.log(`[uploadSingleChunk] FormData参数:`, {
      fileId: fileId,
      chunkIndex: chunk.index.toString(),
      chunkMd5,
      chunkSize: blob.size
    });

    xhr.send(formData);
  });
};

const uploadChunks = async (file: File, fileId: string, chunks: Chunk[]) => {
  const pendingChunks = chunks.filter(c => c.status === "pending");
  console.log(`[uploadChunks] 待上传分片数: ${pendingChunks.length}`);

  for (let i = 0; i < pendingChunks.length; i += CONCURRENT_LIMIT) {
    const batch = pendingChunks.slice(i, i + CONCURRENT_LIMIT);
    await Promise.all(batch.map(chunk => uploadSingleChunk(file, fileId, chunk)));
  }
};

export const uploadFile = async (file: File) => {
  const { addFile, updateFileStatus } = useFileStore.getState();
  
  try {
    const fileId = await addFile(file);
    console.log(`[uploadFile] 已获取 fileId: ${fileId}`);

    const latestFiles = useFileStore.getState().files; 
    const fileInfo = latestFiles.find(f => f.fileId === fileId);

    if (!fileInfo) throw new Error("文件初始化失败: 未找到文件信息");

    const { chunks, totalChunks } = fileInfo;
    const completedChunks = chunks.filter(c => c.status === "success").length;
    
    if (completedChunks === totalChunks) {
      updateFileStatus(fileId, "completed");
      return;
    }

    updateFileStatus(fileId, "uploading");
    await uploadChunks(file, fileId, chunks);
    
    const mergeRes = await fetch("http://localhost:3001/api/upload/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId })
    });

    const mergeData = await mergeRes.json();
    if (!mergeRes.ok) throw new Error(`合并失败: ${mergeData.error}`);

    updateFileStatus(fileId, "completed");
    console.log(`[uploadFile] 文件上传完成: ${file.name}`);
  } catch (err) {
    console.error(`[uploadFile] 上传失败:`, err);

    const latestFiles = useFileStore.getState().files;
    const fileInfo = latestFiles.find(f => f.name === file.name);
    if (fileInfo) updateFileStatus(fileInfo.fileId, "error");
    throw err;
  }
};