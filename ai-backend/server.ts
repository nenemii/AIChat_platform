import express from 'express';
import cors from 'cors';
import { Request, Response } from 'express';
import axios from 'axios';

const app = express();

// 跨域配置
app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Cache-Control'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

app.use(express.json());

// Qwen SSE 转发接口（含完整日志）
app.post('/api/ai-chat', async (req: Request, res: Response) => {
  console.log('\n==================================================');
  console.log(`[${new Date().toLocaleTimeString()}] 收到前端对话请求`);
  const { context } = req.body;
  
  // 校验对话历史格式
  if (!context || !Array.isArray(context)) {
    console.error(`[${new Date().toLocaleTimeString()}] 错误：对话历史格式无效，context =`, context);
    res.status(400).write(`data: [ERROR] 对话历史格式错误\n\n`);
    res.end();
    return;
  }
  console.log(`[${new Date().toLocaleTimeString()}] 前端传入对话上下文：`, JSON.stringify(context));

  // SSE 响应头配置
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');

  try {
    console.log(`[${new Date().toLocaleTimeString()}] 发起 Qwen API 调用（流式）`);
    // 调用 Qwen 大模型流式接口
    const qwenResponse = await axios.post(
      'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      {
        model: 'qwen-plus',
        messages: context, // 直接传递对话历史（无需 input 嵌套）
        stream: true // 流式开关直接放顶层
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer sk-030e6000caed440580f88c1560800909' // 替换为你的有效API Key
        },
        responseType: 'stream'
      }
    );

    console.log(`[${new Date().toLocaleTimeString()}] Qwen API 连接成功，开始接收流式响应`);
    // 转发 Qwen 流式响应
    // server.ts（仅修改 data 解析部分，其他代码不变）
qwenResponse.data.on('data', (chunk: Buffer) => {
  const chunkStr = chunk.toString().trim();
  console.log(`[${new Date().toLocaleTimeString()}] Qwen 原始响应 chunk：`, chunkStr || '（空chunk）');

  // 解析所有 data 行
  const dataLines = chunkStr.split('\n').filter(line => line.startsWith('data:'));
  console.log(`[${new Date().toLocaleTimeString()}] 解析出 data 行数量：`, dataLines.length);
  
  dataLines.forEach((line, index) => {
    const jsonStr = line.slice(5).trim();
    console.log(`[${new Date().toLocaleTimeString()}] 第 ${index+1} 行 data 解析后：`, jsonStr);

    if (!jsonStr) {
      console.log(`[${new Date().toLocaleTimeString()}] 跳过空 data 行`);
      return;
    }

    if (jsonStr === '[DONE]') {
      console.log(`[${new Date().toLocaleTimeString()}] 收到 Qwen 原生 [DONE]，转发给前端`);
      res.write(`data: [DONE]\n\n`);
      res.flushHeaders();
      return;
    }

    try {
      const data = JSON.parse(jsonStr);
      console.log(`[${new Date().toLocaleTimeString()}] Qwen 响应对象：`, JSON.stringify(data));
      
      // 🔴 关键修改：正确读取文本内容（Qwen 兼容 OpenAI 格式，文本在 choices[0].delta.content）
      const content = data.choices?.[0]?.delta?.content || '';
      // 🔴 关键修改：正确读取结束标识
      const finishReason = data.choices?.[0]?.finish_reason;

      console.log(`[${new Date().toLocaleTimeString()}] Qwen 文本片段：`, content || '（无文本）');
      console.log(`[${new Date().toLocaleTimeString()}] Qwen 结束标识 finish_reason：`, finishReason);

      // 有文本内容就转发给前端
      if (content) {
        res.write(`data: ${content}\n\n`);
        res.flushHeaders();
        console.log(`[${new Date().toLocaleTimeString()}] 转发文本片段给前端：`, content);
      }

      // 有结束标识（stop）时，发送 [DONE]
      if (finishReason === 'stop') {
        console.log(`[${new Date().toLocaleTimeString()}] Qwen 响应完成（finish_reason=stop），发送 [DONE]`);
        res.write(`data: [DONE]\n\n`);
        res.flushHeaders();
      }
    } catch (e) {
      console.error(`[${new Date().toLocaleTimeString()}] 解析 Qwen 响应失败：`, e, '错误数据：', jsonStr);
    }
  });
});
    // 监听流结束
    qwenResponse.data.on('end', () => {
      console.log(`[${new Date().toLocaleTimeString()}] Qwen 流式响应完全结束`);
      res.end();
    });

    // 监听流错误
    qwenResponse.data.on('error', (err: Error) => {
      console.error(`[${new Date().toLocaleTimeString()}] Qwen API 流式错误：`, err.stack);
      res.write(`data: [ERROR] Qwen API流错误：${err.message}\n\n`);
      res.end();
    });

  } catch (err: any) {
    console.error(`[${new Date().toLocaleTimeString()}] 调用 Qwen API 失败（外层错误）：`, err.stack);
    res.write(`data: [ERROR] 调用大模型失败：${err.message}\n\n`);
    res.end();
  }

  // 客户端断开连接处理
  req.on('close', () => {
    console.log(`[${new Date().toLocaleTimeString()}] 客户端主动断开连接`);
    res.end();
  });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`[${new Date().toLocaleTimeString()}] 后端服务运行在 http://localhost:${PORT}`);
});