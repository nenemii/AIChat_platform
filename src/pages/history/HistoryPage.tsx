import styles from './HistoryPage.module.css';
import { useSessionStore } from '../../store/sessionStore';
import { useNavigate } from 'react-router-dom';
import { Card, List, Typography, Button, Empty } from 'antd';

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
      <Card
        title="会话历史"
        extra={
          <Button type="primary" onClick={handleCreateSession}>
            新建会话
          </Button>
        }
      >
        {sessions.length === 0 ? (
          <Empty description="暂无会话，点击“新建会话”开始聊天" />
        ) : (
          <List
            itemLayout="vertical"
            dataSource={sessions}
            renderItem={(s) => (
              <List.Item
                key={s.id}
                onClick={() => handleOpenSession(s.id)}
                className={`${styles.item} ${s.id === activeSessionId ? styles.active : ''}`}
              >
                <List.Item.Meta
                  title={
                    <Typography.Text strong className={styles.title}>
                      {s.title}
                    </Typography.Text>
                  }
                  description={
                    <div className={styles.meta}>
                      <span>创建时间：{new Date(s.createdAt).toLocaleString()}</span>
                      <span>最近活跃：{new Date(s.updatedAt).toLocaleString()}</span>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>
    </div>
  );
};

export default HistoryPage;