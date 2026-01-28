import { create } from "zustand";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { useSessionStore } from "./sessionStore";
import { useFileStore } from "./fileStore";

interface Message {
  id: string;
  sessionId: string;
  content: string;
  role: "user" | "assistant";
  status: "loading" | "complete";
}

interface ChatStore {
  messages: Message[];
  inputValue: string;
  isLoading: boolean;
  error: string | null;
  abortController: AbortController | null;
  setInputValue: (value: string) => void;
  addMessage: (msg: Omit<Message, "id" | "sessionId">) => void;
  clearMessages: () => void;
  appendAssistantMessage: (messageId: string, chunk: string) => void;
  sendMessage: () => Promise<void>;
  clearError: () => void;
  cancelSSE: () => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  inputValue: "",
  isLoading: false,
  error: null,
  abortController: null,

  setInputValue: (value) => set({ inputValue: value }),

  addMessage: (msg) => {
    const { activeSessionId, ensureSession, touchSession } = useSessionStore.getState();
    const sessionId = activeSessionId ?? ensureSession();
    const id = `${Date.now()}-${Math.random().toString(36).slice(-4)}`;
    touchSession(sessionId);
    set((state) => ({
      messages: [...state.messages, { ...msg, id, sessionId }],
      inputValue: ""
    }));
  },

  clearMessages: () => set({ messages: [] }),

  clearError: () => set({ error: null }),

  appendAssistantMessage: (messageId, chunk) => set((state) => ({
    messages: state.messages.map((msg) =>
      msg.id === messageId ? { ...msg, content: msg.content + chunk } : msg
    )
  })),

  cancelSSE: () => {
    const { abortController } = get();
    if (abortController) {
      console.log(`[${new Date().toLocaleTimeString()}] 执行 cancelSSE，中断连接`);
      abortController.abort();
      set({ abortController: null, isLoading: false });
    }
  },

  sendMessage: async () => {
    const { messages, isLoading, appendAssistantMessage } = get();
    const { activeSessionId, ensureSession, touchSession } = useSessionStore.getState();
    const sessionId = activeSessionId ?? ensureSession();
    const sessionMessages = messages.filter((msg) => msg.sessionId === sessionId);
    console.log(`[${new Date().toLocaleTimeString()}] 进入 sendMessage 函数，isLoading=${isLoading}`);

    if (isLoading) {
      console.log(`[${new Date().toLocaleTimeString()}] 跳过重复请求（isLoading=true）`);
      return;
    }

    //筛选所有用户消息，取最后一条
    const userMessages = sessionMessages.filter(msg => msg.role === "user");
    const lastUserMsg = userMessages[userMessages.length - 1];
    console.log(`[${new Date().toLocaleTimeString()}] 最后一条用户消息：`, lastUserMsg ? JSON.stringify(lastUserMsg) : '无');

    // 基于用户消息判断是否发起请求
    if (!lastUserMsg) {
      console.log(`[${new Date().toLocaleTimeString()}] 未检测到有效用户消息，不发起 SSE`);
      return;
    }

    // 创建AI加载消息（此时消息列表最后一条会变成AI消息，但不影响前面的判断）
    const assistantMessageId = `${Date.now()}-assistant`;
    const abortController = new AbortController();
    console.log(`[${new Date().toLocaleTimeString()}] 创建 AI 加载消息，ID=${assistantMessageId}`);
    touchSession(sessionId);
    set((state) => ({
      messages: [...state.messages, {
        id: assistantMessageId,
        sessionId,
        content: "",
        role: "assistant",
        status: "loading"
      }],
      isLoading: true,
      error: null,
      abortController
    }));

    // 构建Qwen对话上下文（包含所有有效消息，确保上下文完整）
    const conversationContext = sessionMessages
      .filter(msg => msg.content.trim()) // 过滤空消息
      .map(({ role, content }) => ({
        role: role === "user" ? "user" : "assistant",
        content: content
      }));
    console.log(`[${new Date().toLocaleTimeString()}] 构建 Qwen 对话上下文：`, JSON.stringify(conversationContext));

    // 取最近一个已完成上传的文件，作为本轮对话的文档上下文
    const fileState = useFileStore.getState();
    const completedFiles = fileState.files.filter(f => f.status === "completed" && f.url);
    const latestFile = completedFiles[completedFiles.length - 1];
    const fileContext = latestFile
      ? { fileName: latestFile.name, url: latestFile.url as string }
      : null;
    if (fileContext) {
      console.log(`[${new Date().toLocaleTimeString()}] 将随对话发送文档信息：`, fileContext);
    }

    // 30秒超时逻辑
    const timeoutId = setTimeout(() => {
      console.warn(`[${new Date().toLocaleTimeString()}] SSE 请求超时（30秒），自动结束加载状态`);
      set((state) => ({
        messages: state.messages.map((msg) =>
          msg.id === assistantMessageId ? { ...msg, status: "complete" } : msg
        ),
        isLoading: false,
        abortController: null
      }));
      abortController.abort();
    }, 30000);

    try {
      console.log(`[${new Date().toLocaleTimeString()}] 发起 SSE 请求：http://localhost:3001/api/ai-chat`);
      await fetchEventSource("http://localhost:3001/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: conversationContext, file: fileContext }),
        signal: abortController.signal,
        keepalive: true,
        onopen: async(response) => {
          console.log(`[${new Date().toLocaleTimeString()}] SSE 连接打开，响应状态：${response.status} ${response.statusText}`);
          if (response.status !== 200) {
            throw new Error(`服务器错误: ${response.statusText}`);
          }
        },
        onmessage: (event) => {
          console.log(`[${new Date().toLocaleTimeString()}] 收到 SSE 消息，data=${event.data}`);

          if (event.data === "[DONE]") {
            console.log(`[${new Date().toLocaleTimeString()}] 收到 [DONE] 标识，更新 AI 消息为完成状态`);
            clearTimeout(timeoutId);
            set((state) => ({
              messages: state.messages.map((msg) =>
                msg.id === assistantMessageId ? { ...msg, status: "complete" } : msg
              ),
              abortController: null
            }));
            return;
          }

          if (event.data.startsWith("[ERROR]")) {
            const errorMsg = event.data.slice(7);
            console.error(`[${new Date().toLocaleTimeString()}] SSE 错误消息：${errorMsg}`);
            clearTimeout(timeoutId);
            set({ error: errorMsg, isLoading: false, abortController: null });
            return;
          }

          // 追加消息片段
          appendAssistantMessage(assistantMessageId, event.data);
          const currentContent = get().messages.find(msg => msg.id === assistantMessageId)?.content || '';
          console.log(`[${new Date().toLocaleTimeString()}] 追加 AI 消息片段，当前累计内容：${currentContent}`);
        },
        onclose: () => {
          console.log(`[${new Date().toLocaleTimeString()}] SSE 连接关闭`);
          clearTimeout(timeoutId);
          set((state) => ({
            isLoading: false,
            abortController: null,
            // 如果连接意外关闭但消息仍是loading状态，视为已结束，展示已收到的内容
            messages: state.messages.map((msg) =>
              msg.id === assistantMessageId && msg.role === "assistant" && msg.status === "loading"
                ? { ...msg, status: "complete" }
                : msg
            )
          }));
        },
        onerror: (err) => {
          console.error(`[${new Date().toLocaleTimeString()}] SSE 连接错误：`, err.stack);
          clearTimeout(timeoutId);
          set({
            error: `获取回复失败: ${err.message}`,
            isLoading: false,
            abortController: null,
            messages: messages.filter(msg => msg.id !== assistantMessageId)
          });
          abortController.abort();
        }
      });
    } catch (err: any) {
      console.error(`[${new Date().toLocaleTimeString()}] SSE 请求外层错误：`, err.stack);
      clearTimeout(timeoutId);
      set({
        error: `请求失败: ${err.message}`,
        isLoading: false,
        abortController: null,
        messages: messages.filter(msg => msg.id !== assistantMessageId)
      });
    }
  }
}));