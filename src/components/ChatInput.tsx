import styles from './ChatInput.module.css';
import { useChatStore } from '../store/chatStore';
import FileUpload from './FileUpload';
import type { ReactNode } from 'react';
import { Input, Button, Tooltip } from 'antd';
import { SendOutlined, LoadingOutlined } from '@ant-design/icons';

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

  const handlePressEnter = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!e.shiftKey && !isLoading) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={styles.inputContainer}>
      <FileUpload />
      <Input.TextArea
        className={styles.inputField}
        placeholder="请输入消息，Shift+Enter 换行..."
        autoSize={{ minRows: 1, maxRows: 4 }}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onPressEnter={handlePressEnter}
        disabled={isLoading}
        aria-label="聊天输入框"
      />
      <Tooltip title={isLoading ? '发送中...' : '发送'}>
        <Button
          type="primary"
          shape="circle"
          size="large"
          icon={isLoading ? <LoadingOutlined /> : <SendOutlined />}
          className={styles.sendButton}
          onClick={handleSend}
          disabled={!inputValue.trim() || isLoading}
          aria-label="发送消息"
        />
      </Tooltip>
    </div>
  );
};

export default ChatInput;