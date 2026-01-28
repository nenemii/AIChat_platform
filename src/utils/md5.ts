import SparkMD5 from "spark-md5";

export const md5OfArrayBuffer = (buffer: ArrayBuffer): string => {
  const hasher = new SparkMD5.ArrayBuffer();
  hasher.append(buffer);
  return hasher.end();
};

export const md5OfBlob = async (blob: Blob): Promise<string> => {
  const buffer = await blob.arrayBuffer();
  return md5OfArrayBuffer(buffer);
};

export const md5OfFile = async (file: File, chunkSize = 2 * 1024 * 1024): Promise<string> => {
  const hasher = new SparkMD5.ArrayBuffer();
  for (let offset = 0; offset < file.size; offset += chunkSize) {
    const slice = file.slice(offset, Math.min(offset + chunkSize, file.size));
    const buffer = await slice.arrayBuffer();
    hasher.append(buffer);
  }
  return hasher.end();
};
