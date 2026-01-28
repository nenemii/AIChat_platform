import React from "react";
import { useNavigate } from "react-router-dom";
import { useChatStore } from "../store/chatStore";
import styles from './MainLayout.module.css';
import ChatInput from "../components/ChatInput";

interface MainLayoutProps {
  menuExpend: boolean;
}

const MainLayout = ({ menuExpend }: MainLayoutProps) => {
  const navigate = useNavigate();
  const { inputValue, setInputValue, addMessage, isLoading } = useChatStore();

  const handleHomeSend = () => {
  if (!inputValue.trim() || isLoading) return;

  const userMessage = inputValue.trim();
  // 1. 添加用户消息
  addMessage({
    role: "user",
    content: userMessage,
    status: "complete"
  });

  // 2. 轮询确认消息已添加到store（确保状态同步）
  const checkInterval = setInterval(() => {
    const { messages } = useChatStore.getState();
    const lastMsg = messages[messages.length - 1];
    // 确认最后一条消息是刚发送的用户消息
    if (lastMsg?.role === "user" && lastMsg.content === userMessage) {
      clearInterval(checkInterval);
      // 3. 确认后再跳转
      navigate("/chat");
      setInputValue("");
      console.log(`[MainLayout] 消息已同步，跳转至Chat页`);
    }
  }, 50); // 每50ms检查一次

  // 超时保护（1秒后强制跳转，避免无限等待）
  setTimeout(() => clearInterval(checkInterval), 1000);
};

  return (
    <div className={menuExpend ? styles.rightBox : styles.bigChatContent}>
      <div className={styles.textBox}>
        <p>有什么能帮助您的</p>
      </div>
      <ChatInput onSend={handleHomeSend} />
    </div>
  );
};

export default MainLayout;