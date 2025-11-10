import { create } from "zustand";
import { fetchEventSource } from "@microsoft/fetch-event-source";

interface Message {
  id: string;
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
  addMessage: (msg: Omit<Message, "id">) => void;
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

  addMessage: (msg) => set((state) => ({
    messages: [...state.messages, { ...msg, id: `${Date.now()}-${Math.random().toString(36).slice(-4)}` }],
    inputValue: ""
  })),

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
    const { messages, isLoading, appendAssistantMessage} = get();
    console.log(`[${new Date().toLocaleTimeString()}] 进入 sendMessage 函数，isLoading=${isLoading}`);

    if (isLoading) {
      console.log(`[${new Date().toLocaleTimeString()}] 跳过重复请求（isLoading=true）`);
      return;
    }

    const lastMsg = messages[messages.length - 1];
    console.log(`[${new Date().toLocaleTimeString()}] 最后一条消息：`, lastMsg ? JSON.stringify(lastMsg) : '无');
    if (!lastMsg || lastMsg.role !== "user") {
      console.log(`[${new Date().toLocaleTimeString()}] 未检测到有效用户消息，不发起 SSE`);
      return;
    }

    // 创建AI加载消息
    const assistantMessageId = `${Date.now()}-assistant`;
    const abortController = new AbortController();
    console.log(`[${new Date().toLocaleTimeString()}] 创建 AI 加载消息，ID=${assistantMessageId}`);
    set((state) => ({
      messages: [...state.messages, {
        id: assistantMessageId,
        content: "",
        role: "assistant",
        status: "loading"
      }],
      isLoading: true,
      error: null,
      abortController
    }));

    // 构建Qwen对话上下文
    const conversationContext = messages
      .filter(msg => msg.content.trim())
      .map(({ role, content }) => ({
        role: role === "user" ? "user" : "assistant",
        content: content
      }));
    console.log(`[${new Date().toLocaleTimeString()}] 构建 Qwen 对话上下文：`, JSON.stringify(conversationContext));

    // 30秒超时逻辑（避免一直loading）
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
        body: JSON.stringify({ context: conversationContext }),
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
            clearTimeout(timeoutId); // 清除超时
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
          set({ isLoading: false, abortController: null });
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