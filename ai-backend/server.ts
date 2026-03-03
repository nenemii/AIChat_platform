import express from 'express';
import cors from 'cors';
import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import multer from 'multer';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import { Pinecone } from '@pinecone-database/pinecone';

// 扩展Express Request接口
declare global {
  namespace Express {
    interface Request {
      file?: Express.Multer.File;
    }
  }
}



type ChatMode = 'chat' | 'rag' | 'agent';

interface VectorChunk {
  id: string;
  text: string;
  embedding: number[];
}

interface VectorIndex {
  fileName: string;
  chunks: VectorChunk[];
}

const vectorStore = new Map<string, VectorIndex>();

const DEFAULT_CHUNK_SIZE = 800; // 按字符数粗略切分

// Pinecone 配置
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'ai-chat-docs';

const pinecone = PINECONE_API_KEY
  ? new Pinecone({ apiKey: PINECONE_API_KEY })
  : null;

const app = express();

// 跨域配置
app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['POST', 'GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Cache-Control'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// 非文件上传请求使用json解析
app.use(express.json({
  type: (req) => !req.headers['content-type']?.includes('multipart/form-data')
}));

// 文件目录配置
const CHUNK_DIR = path.resolve(__dirname, 'chunks');
const UPLOAD_DIR = path.resolve(__dirname, 'uploads');

console.log(`[${new Date().toLocaleTimeString()}] 分片目录: ${CHUNK_DIR}`);
console.log(`[${new Date().toLocaleTimeString()}] 上传目录: ${UPLOAD_DIR}`);

// 确保目录可写
const ensureDirAndWritable = async (dir: string) => {
  try {
    await fsPromises.access(dir);
  } catch {
    await fsPromises.mkdir(dir, { recursive: true });
    console.log(`[${new Date().toLocaleTimeString()}] 创建目录: ${dir}`);
  }

  // 验证写入权限
  const testFile = path.join(dir, '.write-test');
  try {
    await fsPromises.writeFile(testFile, 'test');
    await fsPromises.unlink(testFile);
    console.log(`[${new Date().toLocaleTimeString()}] 目录可写验证通过: ${dir}`);
  } catch (err) {
    console.error(`[${new Date().toLocaleTimeString()}] 目录不可写！请检查权限: ${dir}`, err);
    throw new Error(`目录无写入权限: ${dir}`);
  }
};

// multer配置：先临时保存文件（不依赖参数）
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 直接使用分片目录，不依赖参数
    cb(null, CHUNK_DIR);
  },
  filename: (req, file, cb) => {
    // 生成临时文件名（避免依赖fileId和chunkIndex）
    const tempFileName = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    console.log(`[multer] 临时文件生成: ${tempFileName}`);
    cb(null, tempFileName);
  }
});

const upload = multer({ storage });

// 文件元数据存储
const fileMetadata = new Map<string, {
  name: string;
  size: number;
  totalChunks: number;
  uploadedChunks: number[];
  fileMd5?: string;
}>();

const md5OfFile = async (filePath: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (data) => hash.update(data));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
};

// 从上传的文件中提取文本内容（支持 docx / pdf）
const extractTextFromFile = async (filePath: string): Promise<string> => {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.docx') {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value || '';
  }

  if (ext === '.pdf') {
    const buffer = await fsPromises.readFile(filePath);
    const data = await pdfParse(buffer as unknown as Buffer);
    return data.text || '';
  }

  if (ext === '.doc') {
    throw new Error('暂不支持 .doc，请转换为 .docx 或 PDF 后再上传');
  }

  throw new Error(`不支持的文件类型: ${ext}`);
};

// ==== 基于 DashScope 官方 embedding 接口的向量化与向量检索工具函数（本地内存向量库，仅存向量）====

const splitIntoChunks = (text: string, size: number = DEFAULT_CHUNK_SIZE): string[] => {
  const normalized = text.replace(/\r\n/g, '\n');
  const paragraphs = normalized.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    const candidate = current ? `${current}\n\n${para}` : para;
    if (candidate.length > size && current) {
      chunks.push(current.trim());
      current = para;
    } else {
      current = candidate;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
};

const cosineSimilarity = (a: number[], b: number[]): number => {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

// 调用 DashScope 兼容模式的 embedding 接口，生成文本向量
const createEmbeddings = async (texts: string[], apiKey: string): Promise<number[][]> => {
  if (!texts.length) return [];

  const resp = await axios.post(
    'https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings',
    {
      model: 'text-embedding-v2',
      input: texts
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      }
    }
  );

  const data: any = resp.data;
  if (!data || !Array.isArray(data.data)) {
    throw new Error('无效的 embedding 响应格式');
  }

  return data.data.map((item: any) => item.embedding as number[]);
};

// 读取并切分文件文本，调用 DashScope embedding 构建向量索引
const indexFileToVectorStore = async (fileName: string, filePath: string) => {
  try {
    const apiKey = process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY;
    if (!apiKey) {
      console.warn(`[${new Date().toLocaleTimeString()}] 未配置 DASHSCOPE_API_KEY，跳过向量索引: ${fileName}`);
      return;
    }

    const text = await extractTextFromFile(filePath);
    if (!text.trim()) {
      console.warn(`[${new Date().toLocaleTimeString()}] 文件文本为空，跳过向量索引: ${fileName}`);
      return;
    }

    const rawChunks = splitIntoChunks(text, DEFAULT_CHUNK_SIZE);
    if (!rawChunks.length) {
      console.warn(`[${new Date().toLocaleTimeString()}] 文件切分结果为空，跳过向量索引: ${fileName}`);
      return;
    }

    const embeddings = await createEmbeddings(rawChunks, apiKey);
    if (!embeddings.length) {
      console.warn(`[${new Date().toLocaleTimeString()}] 未获取到 embedding，跳过向量索引: ${fileName}`);
      return;
    }

    const chunks: VectorChunk[] = rawChunks.map((chunkText, i) => ({
      id: `${fileName}-${i}`,
      text: chunkText,
      embedding: embeddings[i] || []
    }));

    vectorStore.set(fileName, {
      fileName,
      chunks
    });

    console.log(
      `[${new Date().toLocaleTimeString()}] 已为文件 ${fileName} 构建向量索引，分片数=${chunks.length}`
    );

    // 将向量写入 Pinecone，方便持久化与高性能相似度检索
    if (pinecone) {
      try {
        const index = pinecone.index(PINECONE_INDEX_NAME);
        await index.upsert(
          chunks.map((chunk, i) => ({
            id: chunk.id,
            values: chunk.embedding,
            metadata: {
              fileName,
              chunkIndex: i,
              text: chunk.text
            }
          }))
        );
        console.log(
          `[${new Date().toLocaleTimeString()}] 已将文件 ${fileName} 的向量分片写入 Pinecone，分片数=${chunks.length}`
        );
      } catch (err) {
        console.error(`[Pinecone upsert 失败] file=${fileName}`, err);
      }
    } else {
      console.warn(
        `[${new Date().toLocaleTimeString()}] 未配置 PINECONE_API_KEY，当前仅使用内存向量索引（vectorStore）`
      );
    }
  } catch (err) {
    console.error(`[向量索引失败] file=${fileName}`, err);
  }
};

// 使用 DashScope embedding 为问题生成向量，并与本地索引计算余弦相似度
const retrieveRelevantChunks = async (
  fileName: string,
  question: string,
  topK: number = 3
): Promise<VectorChunk[]> => {
  const apiKey = process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY;
  if (!apiKey) {
    console.warn(`[${new Date().toLocaleTimeString()}] 未配置 DASHSCOPE_API_KEY，无法执行向量检索`);
    return [];
  }

  if (!question.trim()) return [];

  const [queryVec] = await createEmbeddings([question], apiKey);
  if (!queryVec || !queryVec.length) return [];

  // 优先从 Pinecone 检索
  if (pinecone) {
    try {
      const index = pinecone.index(PINECONE_INDEX_NAME);
      const result = await index.query({
        topK,
        vector: queryVec,
        includeMetadata: true,
        filter: {
          fileName
        }
      });

      const matches = (result.matches || []).filter((m: any) => m.metadata && m.metadata.text);
      if (matches.length > 0) {
        return matches.map((m: any) => ({
          id: m.id as string,
          text: m.metadata.text as string,
          embedding: []
        }));
      }
    } catch (err) {
      console.error(`[Pinecone query 失败] file=${fileName}`, err);
    }
  }

  // 回退：使用内存中的向量索引
  const index = vectorStore.get(fileName);
  if (!index) {
    console.warn(`[${new Date().toLocaleTimeString()}] 未找到本地向量索引，file=${fileName}`);
    return [];
  }

  const scored = index.chunks
    .map((chunk) => ({
      chunk,
      score: cosineSimilarity(queryVec, chunk.embedding)
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored.map((s) => s.chunk);
};

// 初始化服务器
const initServer = async () => {
  try {
    await Promise.all([
      ensureDirAndWritable(CHUNK_DIR),
      ensureDirAndWritable(UPLOAD_DIR)
    ]);

    // 1. 初始化上传接口
    app.post('/api/upload/init', (req: Request, res: Response) => {
      try {
        console.log(`[${new Date().toLocaleTimeString()}] 初始化请求:`, req.body);
        const { fileName, fileSize, totalChunks, fileMd5 } = req.body;

        if (!fileName || !fileSize || !totalChunks) {
          return res.status(400).json({ error: '缺少fileName/fileSize/totalChunks' });
        }

        const fileId = uuidv4();
        fileMetadata.set(fileId, { name: fileName, size: fileSize, totalChunks, uploadedChunks: [], fileMd5 });
        console.log(`[${new Date().toLocaleTimeString()}] 初始化成功: fileId=${fileId}`);
        res.json({ fileId, uploadedChunks: [] });
      } catch (err) {
        console.error(`[初始化失败]`, err);
        res.status(500).json({ error: '初始化失败' });
      }
    });

    // 2. 查询已上传分片
    app.get('/api/upload/chunks', (req: Request, res: Response) => {
      try {
        const { fileId } = req.query;
        if (!fileId || typeof fileId !== 'string') {
          return res.status(400).json({ error: 'fileId无效' });
        }

        const metadata = fileMetadata.get(fileId);
        if (!metadata) return res.status(404).json({ error: '文件不存在' });
        
        res.json({ uploadedChunks: metadata.uploadedChunks });
      } catch (err) {
        console.error(`[查询分片失败]`, err);
        res.status(500).json({ error: '查询失败' });
      }
    });

    // 3. 上传分片（核心修复：先存临时文件，再用参数重命名）
    app.post(
      '/api/upload/chunk',
      upload.single('chunk'), // 只接收名为"chunk"的文件
      (err: any, req: Request, res: Response, next: NextFunction) => {
        if (err) {
          console.error(`[multer上传错误]`, err.message);
          return res.status(500).json({ error: `分片上传失败: ${err.message}` });
        }
        next();
      },
      async (req: Request, res: Response) => {
        try {
          // 此时req.body已被multer解析（确保参数可用）
          const { fileId, chunkIndex, chunkMd5 } = req.body;
          const index = parseInt(chunkIndex, 10);

          // 1. 验证参数有效性
          if (!fileId || !chunkIndex || isNaN(index) || index < 0) {
            console.error(`[参数错误] 实际收到: fileId=${fileId}, chunkIndex=${chunkIndex}`);
            // 清理临时文件
            if (req.file) await fsPromises.unlink(req.file.path).catch(() => {});
            return res.status(400).json({ error: '缺少fileId或chunkIndex（格式错误）' });
          }

          // 2. 验证文件是否接收成功
          if (!req.file) {
            console.error(`[未收到文件] fileId=${fileId}, chunkIndex=${index}`);
            return res.status(400).json({ error: '未收到分片文件' });
          }

          // 3. 手动重命名临时文件为目标文件名（fileId-chunkIndex）
          const tempFilePath = req.file.path; // 临时文件路径
          const targetFilePath = path.join(CHUNK_DIR, `${fileId}-${index}`); // 目标路径

          try {
            // 确保目标路径不存在（避免覆盖）
            await fsPromises.access(targetFilePath);
            console.warn(`[文件已存在] ${targetFilePath}，跳过重命名`);
          } catch {
            // 重命名临时文件
            await fsPromises.rename(tempFilePath, targetFilePath);
            console.log(`[文件重命名] 从${tempFilePath} → ${targetFilePath}`);
          }

          // 4. 验证文件是否保存成功
          try {
            await fsPromises.access(targetFilePath);
          } catch {
            console.error(`[文件未保存] 预期路径: ${targetFilePath}`);
            return res.status(500).json({ error: '分片文件保存失败（磁盘写入失败）' });
          }

          // 4.1 可选：分片MD5校验
          if (chunkMd5 && typeof chunkMd5 === 'string') {
            const actualMd5 = await md5OfFile(targetFilePath);
            if (actualMd5 !== chunkMd5) {
              console.error(`[MD5不匹配] fileId=${fileId} chunkIndex=${index} expected=${chunkMd5} actual=${actualMd5}`);
              await fsPromises.unlink(targetFilePath).catch(() => {});
              return res.status(400).json({ error: '分片MD5校验失败' });
            }
          }

          // 5. 更新元数据
          const metadata = fileMetadata.get(fileId);
          if (!metadata) {
            await fsPromises.unlink(targetFilePath).catch(() => {}); // 清理无效文件
            return res.status(404).json({ error: '文件元数据不存在' });
          }

          if (!metadata.uploadedChunks.includes(index)) {
            metadata.uploadedChunks.push(index);
            fileMetadata.set(fileId, metadata);
          }

          console.log(`[${new Date().toLocaleTimeString()}] 分片上传成功: ${targetFilePath}`);
          res.json({ success: true });
        } catch (err) {
          console.error(`[分片接口错误]`, err);
          res.status(500).json({ error: `分片处理失败: ${(err as Error).message}` });
        }
      }
    );

    // 4. 合并分片
    app.post('/api/upload/merge', async (req: Request, res: Response) => {
      try {
        const { fileId } = req.body;
        if (!fileId) return res.status(400).json({ error: 'fileId无效' });

        const metadata = fileMetadata.get(fileId);
        if (!metadata) return res.status(404).json({ error: '文件不存在' });

        const { name: fileName, totalChunks } = metadata;
        if (metadata.uploadedChunks.length !== totalChunks) {
          return res.status(400).json({ 
            error: `分片不完整（已上传${metadata.uploadedChunks.length}/${totalChunks}）` 
          });
        }

        const filePath = path.join(UPLOAD_DIR, fileName);
        const writeStream = fs.createWriteStream(filePath);

        for (let i = 0; i < totalChunks; i++) {
          const chunkPath = path.join(CHUNK_DIR, `${fileId}-${i}`);
          await fsPromises.access(chunkPath);

          // 确保每个分片读完后再处理下一个分片
          await new Promise<void>((resolve, reject) => {
            const readStream = fs.createReadStream(chunkPath);
            readStream.on('error', reject);
            readStream.on('end', () => resolve());
            readStream.pipe(writeStream, { end: false });
          });

          await fsPromises.unlink(chunkPath);
          console.log(`[合并] 已处理分片: ${chunkPath}`);
        }

        writeStream.end();

        // 等待写入完成后再做整文件校验
        await new Promise<void>((resolve, reject) => {
          writeStream.on('finish', () => resolve());
          writeStream.on('error', reject);
        });

        if (metadata.fileMd5) {
          const mergedMd5 = await md5OfFile(filePath);
          if (mergedMd5 !== metadata.fileMd5) {
            console.error(`[合并后MD5不匹配] fileId=${fileId} expected=${metadata.fileMd5} actual=${mergedMd5}`);
            await fsPromises.unlink(filePath).catch(() => {});
            return res.status(500).json({ error: '合并文件MD5校验失败' });
          }
        }

        fileMetadata.delete(fileId);
        console.log(`[${new Date().toLocaleTimeString()}] 合并完成: ${filePath}`);

        // 合并完成后，异步构建该文件的向量索引，用于后续 RAG 检索
        indexFileToVectorStore(fileName, filePath).catch((err) => {
          console.error(`[构建向量索引失败] file=${fileName}`, err);
        });

        res.json({ success: true, url: `/uploads/${fileName}` });
      } catch (err) {
        console.error(`[合并失败]`, err);
        res.status(500).json({ error: `合并失败: ${(err as Error).message}` });
      }
    });

    // 静态文件服务
    app.use('/uploads', express.static(UPLOAD_DIR));

    // AI对话接口（支持 chat / rag / agent 模式）
    app.post('/api/ai-chat', async (req: Request, res: Response) => {
      console.log(`[${new Date().toLocaleTimeString()}] 收到对话请求:`, req.body.context);
      const { context, file, mode } = req.body as { context: any[]; file?: { fileName: string; url: string }; mode?: ChatMode };

      const chatMode: ChatMode = mode ?? 'chat';

      const apiKey = process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY;
      if (!apiKey) {
        res.status(500).write(`data: [ERROR] 缺少环境变量 DASHSCOPE_API_KEY（或 QWEN_API_KEY）\n\n`);
        return res.end();
      }

      if (!context || !Array.isArray(context)) {
        res.status(400).write(`data: [ERROR] 对话格式错误\n\n`);
        return res.end();
      }

      // 根据 mode 构建上游模型的 messages
      const messages: any[] = [];

      // agent 模式：预先加入一个简单的 system 说明，后续可以在这里接工具调用循环
      if (chatMode === 'agent') {
        messages.push({
          role: 'system',
          content:
            '你是一个可以分步骤思考的智能助手。如果任务复杂，请先列出解决步骤，再逐步给出详细答案。当前版本尚未接入真实工具调用，请直接在回答中清晰展示推理过程。'
        });
      }

      // RAG 模式：优先使用向量检索命中的 Top-K 片段
      if (chatMode === 'rag' && file && file.fileName) {
        const lastUserMsg = [...context].reverse().find((m) => m.role === 'user');
        if (lastUserMsg && typeof lastUserMsg.content === 'string') {
          const chunks = await retrieveRelevantChunks(file.fileName, lastUserMsg.content, 3);
          if (chunks.length > 0) {
            const ragContext = chunks
              .map((c, idx) => `【片段${idx + 1}】\n${c.text}`)
              .join('\n\n');

            messages.push({
              role: 'system',
              content:
                '你是一个基于文档检索的问答助手。请严格优先依据下面提供的文档片段回答用户问题，如果文档中没有相关信息，请明确说明“文档中未找到相关内容”，不要编造。'
            });

            messages.push({
              role: 'user',
              content: `下面是与当前问题最相关的文档片段：\n\n${ragContext}`
            });
          } else {
            console.warn(
              `[${new Date().toLocaleTimeString()}] 向量检索未命中片段，file=${file.fileName}，将退回全文注入模式`
            );
          }
        }
      }

      // 非 RAG 模式或 RAG 回退：若有上传文件，仍按原逻辑将全文注入上下文
      if ((chatMode !== 'rag' || messages.length === 0) && file && file.url) {
        try {
          const fileName = path.basename(file.url);
          const filePath = path.join(UPLOAD_DIR, fileName);
          await fsPromises.access(filePath);
          const text = await extractTextFromFile(filePath);
          if (text.trim()) {
            messages.push({
              role: 'user',
              content: `以下是用户上传的文档内容（${file.fileName}）：\n\n${text}\n\n===== 文档内容结束 =====`
            });
          }
        } catch (err) {
          console.error(`[文档解析失败]`, err);
          // 文档解析失败时，不阻塞对话，只在前面加一条说明
          messages.push({
            role: 'user',
            content: `用户上传的文档（${file.fileName}）解析失败，请只根据后续对话内容回答。`
          });
        }
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      try {
        const qwenResponse = await axios.post(
          'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
          { model: 'qwen-plus', messages: [...messages, ...context], stream: true },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            responseType: 'stream'
          }
        );

        const upstream = qwenResponse.data;

        qwenResponse.data.on('data', (chunk: Buffer) => {
          const dataLines = chunk.toString().split('\n').filter(line => line.startsWith('data:'));
          dataLines.forEach(line => {
            const jsonStr = line.slice(5).trim();
            if (jsonStr === '[DONE]') {
              res.write(`data: [DONE]\n\n`);
              return;
            }
            try {
              const data = JSON.parse(jsonStr);
              const content = data.choices?.[0]?.delta?.content || '';
              if (content) res.write(`data: ${content}\n\n`);
              if (data.choices?.[0]?.finish_reason === 'stop') {
                res.write(`data: [DONE]\n\n`);
              }
            } catch (e) {
              console.error('解析响应失败:', e);
            }
          });
        });

        upstream.on('end', () => res.end());
        upstream.on('error', (err: Error) => {
          res.write(`data: [ERROR] ${err.message}\n\n`);
          res.end();
        });

        req.on('close', () => {
          try {
            upstream.destroy?.();
          } catch {
            // ignore
          }
          res.end();
        });

      } catch (err: any) {
        res.write(`data: [ERROR] ${err.message}\n\n`);
        res.end();
      }
    });

    // 启动服务
    const PORT = 3001;
    app.listen(PORT, () => {
      console.log(`[${new Date().toLocaleTimeString()}] 服务运行在 http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error(`[服务器初始化失败]`, err);
    process.exit(1);
  }
};

initServer();