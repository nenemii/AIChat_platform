import styles from './ChatPage.module.css';
import ChatMessage from '../../components/ChatMessage';
import ChatInput from '../../components/ChatInput';
import { useChatStore } from '../../store/chatStore'; 
import { useSessionStore } from '../../store/sessionStore';
import { useRef, useEffect, memo } from 'react';

interface ChatPageProps {
  menuExpend: boolean;
}

const ChatPage = ({ menuExpend }: ChatPageProps) => {
  const activeSessionId = useSessionStore(state => state.activeSessionId);
  const allMessages = useChatStore(state => state.messages);
  const messages = activeSessionId
    ? allMessages.filter(msg => msg.sessionId === activeSessionId)
    : allMessages;

  // 过滤掉仅用于内部状态的“空内容 + loading”助手消息，避免出现单独一条“正在输入...”气泡
  const visibleMessages = messages.filter(msg =>
    !(msg.role === 'assistant' && msg.status === 'loading' && !msg.content.trim())
  );
  const sendMessage = useChatStore(state => state.sendMessage);
  const isLoading = useChatStore(state => state.isLoading);
  const cancelSSE = useChatStore(state => state.cancelSSE);
  const messageListRef = useRef<HTMLDivElement>(null);

  console.log(`[${new Date().toLocaleTimeString()}] ChatPage 渲染，messages 长度：${messages.length}，isLoading：${isLoading}`);


  // 消息变化时自动滚动到底部
  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages]);

  // 从首页跳转过来时，如果尾部是用户消息且当前未在加载中，则自动触发一次发送
  useEffect(() => {
    if (isLoading || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.role !== 'user') return;

    console.log(`[${new Date().toLocaleTimeString()}] ChatPage 检测到尾部用户消息，自动触发 sendMessage`);
    sendMessage().catch(err => {
      console.error(`[${new Date().toLocaleTimeString()}] ChatPage 自动触发 SSE 失败：`, err);
    });
  }, [messages, isLoading, sendMessage]);

  // 监听AI消息状态变化
  useEffect(() => {
    const aiMessages = messages.filter(msg => msg.role === 'assistant');
    const lastAiMsg = aiMessages[aiMessages.length - 1];
    if (lastAiMsg) {
      console.log(`[${new Date().toLocaleTimeString()}] 最新 AI 消息状态：id=${lastAiMsg.id}，status=${lastAiMsg.status}，content=${lastAiMsg.content}`);
    }
  }, [messages]);

  // 组件卸载时取消SSE
  useEffect(() => {
    console.log(`[${new Date().toLocaleTimeString()}] ChatPage 挂载，注册卸载清理函数`);
    return () => {
      console.log(`[${new Date().toLocaleTimeString()}] ChatPage 组件卸载，执行 cancelSSE`);
      cancelSSE();
    };
  }, [cancelSSE]);

  // 发送新消息（Chat页内发送）
  const handleChatSend = () => {
    console.log(`[${new Date().toLocaleTimeString()}] ChatPage 点击发送按钮`);
    const { inputValue, addMessage, isLoading: storeIsLoading } = useChatStore.getState();
    if (!inputValue.trim() || storeIsLoading) {
      console.log(`[${new Date().toLocaleTimeString()}] 发送拦截：inputValue为空或isLoading=true`);
      return;
    }

    addMessage({
      role: "user",
      content: inputValue.trim(),
      status: "complete"
    });
    console.log(`[${new Date().toLocaleTimeString()}] 已添加用户消息：${inputValue.trim()}`);
    // 直接触发发送（SSE），不再依赖 useEffect 监听
    sendMessage().catch(err => {
      console.error(`[${new Date().toLocaleTimeString()}] ChatPage 点击发送后触发 SSE 失败：`, err);
    });
  };

  return (
    <div className={styles.container}>
      <div className={menuExpend ? styles.chatContent : styles.bigChatContent}>
        <div className={styles.messageList} ref={messageListRef}>
          {visibleMessages.map((msg) => (
            <ChatMessage
              key={msg.id}
              role={msg.role}
              content={msg.content}
              status={msg.status}
            />
          ))}
        </div>
        <ChatInput onSend={handleChatSend} />
      </div>
    </div>
  );
};

export default memo(ChatPage, (prevProps, nextProps) => {
  const isSame = prevProps.menuExpend === nextProps.menuExpend;
  console.log(`[${new Date().toLocaleTimeString()}] ChatPage memo 比较：prev=${prevProps.menuExpend}，next=${nextProps.menuExpend}，是否复用组件：${isSame}`);
  return isSame;
});