import styles from './ChatInput.module.css';
import { useChatStore } from '../store/chatStore';
import FileUpload from './FileUpload';
import type { ReactNode } from 'react';

interface ChatInputProps {
  onSend: () => void;
  sendButtonText?: ReactNode;
}

const ChatInput = ({ onSend, sendButtonText = "发送" }: ChatInputProps) => {
  const inputValue = useChatStore(state => state.inputValue);
  const setInputValue = useChatStore(state => state.setInputValue);
  const isLoading = useChatStore(state => state.isLoading);

  const handleSend = () => {
    if (!inputValue.trim() || isLoading) return;
    onSend();
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !isLoading) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={styles.inputContainer}>
      <FileUpload />
      <textarea 
        className={styles.inputField} 
        placeholder="请输入消息..." 
        rows={1}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isLoading}
      />
      <button 
        className={styles.sendButton}
        onClick={handleSend} 
        disabled={!inputValue.trim() || isLoading}
      >
        {isLoading ? "发送中..." : sendButtonText}
      </button>
    </div>
  );
};

export default ChatInput;