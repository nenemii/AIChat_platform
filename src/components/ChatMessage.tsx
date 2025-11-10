import styles from './ChatMessage.module.css';

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
    if (role === 'assistant' && status === 'loading') {
      return (
        <div className={styles.loadingWrapper}>
          <span className={styles.loadingText}>正在输入</span>
          <span className={styles.loadingDots}>
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </span>
        </div>
      );
    }
    return content || '（无回复）';
  };

  return (
    <div className={messageClass}>
      <div className={avatarClass}></div>
      <div className={bubbleClass}>{renderMessageContent()}</div>
      <div></div>
    </div>
  );
};

export default ChatMessage;