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

// 扩展Express Request接口
declare global {
  namespace Express {
    interface Request {
      file?: Express.Multer.File;
    }
  }
}

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

          await new Promise((resolve, reject) => {
            const readStream = fs.createReadStream(chunkPath);
            readStream.pipe(writeStream, { end: false });
            readStream.on('end', ()=>resolve);
            readStream.on('error', reject);
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
        res.json({ success: true, url: `/uploads/${fileName}` });
      } catch (err) {
        console.error(`[合并失败]`, err);
        res.status(500).json({ error: `合并失败: ${(err as Error).message}` });
      }
    });

    // 静态文件服务
    app.use('/uploads', express.static(UPLOAD_DIR));

    // AI对话接口
    app.post('/api/ai-chat', async (req: Request, res: Response) => {
      console.log(`[${new Date().toLocaleTimeString()}] 收到对话请求:`, req.body.context);
      const { context } = req.body;

      const apiKey = process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY;
      if (!apiKey) {
        res.status(500).write(`data: [ERROR] 缺少环境变量 DASHSCOPE_API_KEY（或 QWEN_API_KEY）\n\n`);
        return res.end();
      }

      if (!context || !Array.isArray(context)) {
        res.status(400).write(`data: [ERROR] 对话格式错误\n\n`);
        return res.end();
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      try {
        const qwenResponse = await axios.post(
          'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
          { model: 'qwen-plus', messages: context, stream: true },
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