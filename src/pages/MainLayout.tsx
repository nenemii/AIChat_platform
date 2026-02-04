import React from "react";
import { useNavigate } from "react-router-dom";
import { useChatStore } from "../store/chatStore";
import styles from './MainLayout.module.css';
import ChatInput from "../components/ChatInput";
import { Card, Typography } from 'antd';

interface MainLayoutProps {
  menuExpend: boolean;
}

const MainLayout = ({ menuExpend }: MainLayoutProps) => {
  const navigate = useNavigate();
  const { inputValue, setInputValue, addMessage, isLoading } = useChatStore();

  const handleHomeSend = () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    // 1. 添加用户消息到当前会话
    addMessage({
      role: "user",
      content: userMessage,
      status: "complete"
    });

    // 2. 清空输入并跳转到聊天页，由 ChatPage 自动触发 sendMessage
    setInputValue("");
    navigate("/chat");
    console.log(`[MainLayout] 从首页发送消息并跳转到 Chat 页：${userMessage}`);
  };

  return (
    <div className={menuExpend ? styles.rightBox : styles.bigChatContent}>
      <div className={styles.heroWrapper}>
        <Card className={styles.heroCard} bordered>
          <Typography.Title level={2}>有什么能帮助您的？</Typography.Title>
          <Typography.Paragraph type="secondary">
            直接提问代码、产品、文档内容，或先上传文件再进行智能问答。
          </Typography.Paragraph>
        </Card>
      </div>
      <ChatInput onSend={handleHomeSend} sendButtonText="开始聊天" />
    </div>
  );
};

export default MainLayout;