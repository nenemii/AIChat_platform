// src/App.tsx
import ChatPage from './pages/chat/ChatPage';
import './App.css';
import Sidebar from './components/Sidebar';
import { useState, useEffect } from 'react';
import MainLayout from './pages/MainLayout';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HistoryPage from './pages/history/HistoryPage';
import SettingPage from './pages/setting/SettingPage';
import { useThemeStore } from './store/themeStore';
import { ConfigProvider, Layout, theme as antdTheme, Button, Space, Typography } from 'antd';
import { DownOutlined, UpOutlined } from '@ant-design/icons';
import DashboardTopPanel from './components/DashboardTopPanel';


const { Sider, Content, Header } = Layout;

const AppLayout = () => {
  const { theme } = useThemeStore();
  const [collapsed, setCollapsed] = useState(false);
  const [topOpen, setTopOpen] = useState(true);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={240}
        theme={theme === 'dark' ? 'dark' : 'light'}
      >
        <Sidebar menuExpend={!collapsed} setMenuExpend={(v) => setCollapsed(!v)} />
      </Sider>
      <Layout>
        <Header
          style={{
            background: 'var(--card-bg)',
            padding: '0 24px',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography.Text strong>工作台 · 今日概览</Typography.Text>
          <Space>
            <Button
              type="text"
              icon={topOpen ? <UpOutlined /> : <DownOutlined />}
              onClick={() => setTopOpen((v) => !v)}
            >
              {topOpen ? '收起面板' : '展开面板'}
            </Button>
          </Space>
        </Header>
        {topOpen && <DashboardTopPanel />}
        <Content style={{ padding: 0 }}>
          <Routes>
            <Route path="/" element={<MainLayout menuExpend={!collapsed} />} />
            <Route path="/chat" element={<ChatPage menuExpend={!collapsed} />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/setting" element={<SettingPage />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
};

function App() {
  const { theme, initTheme } = useThemeStore();

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  const algorithm = theme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm;

  return (
    <ConfigProvider
      theme={{
        algorithm,
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 8,
        },
      }}
    >
      <Router>
        <AppLayout />
      </Router>
    </ConfigProvider>
  );
}

export default App;