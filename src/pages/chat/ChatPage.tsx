import styles from './ChatPage.module.css';
import ChatMessage from '../../components/ChatMessage';
import ChatInput from '../../components/ChatInput';
import { useChatStore } from '../../store/chatStore'; 
import { useRef, useEffect, memo } from 'react';

interface ChatPageProps {
  menuExpend: boolean;
}

const ChatPage = ({ menuExpend }: ChatPageProps) => {
  const messages = useChatStore(state => state.messages);
  const sendMessage = useChatStore(state => state.sendMessage);
  const isLoading = useChatStore(state => state.isLoading);
  const cancelSSE = useChatStore(state => state.cancelSSE);
  const messageListRef = useRef<HTMLDivElement>(null);

  console.log(`[${new Date().toLocaleTimeString()}] ChatPage 渲染，messages 长度：${messages.length}，isLoading：${isLoading}`);

  // 监听用户消息，触发SSE请求
  useEffect(() => {
    console.log(`[${new Date().toLocaleTimeString()}] ChatPage 消息监听 useEffect 触发`);
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === "user" && !isLoading) {
      console.log(`[${new Date().toLocaleTimeString()}] 检测到新用户消息，触发 sendMessage：`, lastMsg.content);
      sendMessage().catch(err => {
        console.error(`[${new Date().toLocaleTimeString()}] ChatPage 触发 SSE 失败：`, err);
      });
    }
  }, [messages, isLoading, sendMessage]);

  // 滚动到底部
  useEffect(() => {
    if (messageListRef.current) {
      console.log(`[${new Date().toLocaleTimeString()}] 滚动到底部，scrollHeight：${messageListRef.current.scrollHeight}`);
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages]);

  // 监听AI消息状态变化（关键：排查状态是否更新）
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

  // 发送新消息
  const handleChatSend = () => {
    console.log(`[${new Date().toLocaleTimeString()}] ChatPage 点击发送按钮`);
    const { inputValue, addMessage, isLoading } = useChatStore.getState();
    if (!inputValue.trim() || isLoading) {
      console.log(`[${new Date().toLocaleTimeString()}] 发送拦截：inputValue为空或isLoading=true`);
      return;
    }

    addMessage({
      role: "user",
      content: inputValue.trim(),
      status: "complete"
    });
    console.log(`[${new Date().toLocaleTimeString()}] 已添加用户消息：${inputValue.trim()}`);
  };

  return (
    <div className={styles.container}>
      <div className={menuExpend ? styles.chatContent : styles.bigChatContent}>
        <div className={styles.messageList} ref={messageListRef}>
          {messages.map((msg) => (
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