import styles from './HistoryPage.module.css';
import { useSessionStore } from '../../store/sessionStore';
import { useNavigate } from 'react-router-dom';

const HistoryPage = () => {
  const navigate = useNavigate();
  const { sessions, activeSessionId, setActiveSession, createSession } = useSessionStore();

  const handleOpenSession = (id: string) => {
    setActiveSession(id);
    navigate('/chat');
  };

  const handleCreateSession = () => {
    const id = createSession();
    navigate('/chat');
    setActiveSession(id);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>会话历史</h2>
        <button onClick={handleCreateSession} className={styles.newButton}>
          新建会话
        </button>
      </div>
      <ul className={styles.list}>
        {sessions.length === 0 && (
          <li className={styles.empty}>暂无会话，点击“新建会话”开始聊天</li>
        )}
        {sessions.map((s) => (
          <li
            key={s.id}
            className={`${styles.item} ${s.id === activeSessionId ? styles.active : ''}`}
            onClick={() => handleOpenSession(s.id)}
          >
            <div className={styles.title}>{s.title}</div>
            <div className={styles.meta}>
              <span>
                创建时间：{new Date(s.createdAt).toLocaleString()}
              </span>
              <span>
                最近活跃：{new Date(s.updatedAt).toLocaleString()}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default HistoryPage;