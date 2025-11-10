
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

    // 添加用户消息
    addMessage({
      role: "user",
      content: inputValue.trim(),
      status: "complete"
    });

    // 跳转至对话页
    navigate("/chat", { replace: false });

    // 清空输入框
    setInputValue("");
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