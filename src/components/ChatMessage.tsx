import styles from './ChatMessage.module.css';
import { memo } from 'react';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  status?: 'loading' | 'complete';
}

const ChatMessage = ({ role, content, status = 'complete' }: ChatMessageProps) => {
  const messageClass = role === 'user' ? styles.userMessage : styles.aiMessage;
  const bubbleClass = role === 'user' ? styles.userBubble : styles.aiBubble;
  const avatarClass = role === 'user' ? styles.userAvatar : styles.aiAvatar;

  // 渲染消息内容（加载状态显示动画）
  const renderMessageContent = () => {
    if (role === 'assistant') {
      // 对于助手消息：优先展示实时流式内容；如果还没有内容，给出简单占位
      if (content && content.trim()) return content;
      if (status === 'loading') return '正在输入...';
      return '（无回复）';
    }

    // 用户消息直接展示内容
    return content || '（空消息）';
  };

  return (
    <div className={messageClass}>
      <div className={avatarClass}></div>
      <div className={bubbleClass}>{renderMessageContent()}</div>
      <div></div>
    </div>
  );
};

export default memo(ChatMessage);