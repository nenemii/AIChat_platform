import styles from './ChatMessage.module.css';
import { memo, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';


interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  status?: 'loading' | 'complete';
}

const ChatMessage = ({ role, content, status = 'complete' }: ChatMessageProps) => {
  const messageClass = role === 'user' ? styles.userMessage : styles.aiMessage;
  const bubbleClass = role === 'user' ? styles.userBubble : styles.aiBubble;
  const avatarClass = role === 'user' ? styles.userAvatar : styles.aiAvatar;

  const safeContent = useMemo(()=>{return content || ''},[content])

  // 渲染消息内容（加载状态显示动画）
  const renderMessageContent = () => {
    if (role === 'assistant') {
      // 对于助手消息：优先展示实时流式内容；如果还没有内容，给出简单占位
      // if (content && content.trim()) return content;
      // if (status === 'loading') return '正在输入...';
      if(safeContent.trim()){
        return(
          <ReactMarkdown remarkPlugins={[remarkGfm]}
          components={{
              // 代码块高亮
              code({ inline, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                const codeText = String(children).replace(/\n$/, '');

                if (!inline && match) {
                  return (
                    <SyntaxHighlighter
                      style={oneDark}
                      language={match[1]}
                      PreTag="div"
                      {...props}
                    >
                      {codeText}
                    </SyntaxHighlighter>
                  );
                }

                return (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              }
            }}>
            {safeContent}
            </ReactMarkdown>

            
        )
      }
      if (status === 'loading') {
        return (
          <div className={styles.loadingWrapper}>
            <span className={styles.loadingText}>正在输入</span>
            <span className={styles.loadingDots}>
              <span></span>
              <span></span>
              <span></span>
            </span>
          </div>
        );
      }
      return '（无回复）';
    }

    // 用户消息直接展示内容
    return safeContent || '（空消息）';
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