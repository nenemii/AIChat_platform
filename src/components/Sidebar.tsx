// src/components/Sidebar.tsx
import styles from './Sidebar.module.css';
import { Menu } from 'antd';
import {
  MessageOutlined,
  HistoryOutlined,
  SettingOutlined,
  HomeOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';

interface SidebarProps {
  menuExpend: boolean;
  setMenuExpend: (expanded: boolean) => void;
}

const Sidebar = ({ menuExpend }: SidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();

  const items = [
    { key: '/', icon: <HomeOutlined />, label: '首页' },
    { key: '/chat', icon: <MessageOutlined />, label: '聊天' },
    { key: '/history', icon: <HistoryOutlined />, label: '历史' },
    { key: '/setting', icon: <SettingOutlined />, label: '设置' },
  ];

  return (
    <div className={styles.sidebarShell}>
      <div className={styles.logo}>{menuExpend ? 'AI 聊天助手' : 'AI'}</div>
      <Menu
        mode="inline"
        selectedKeys={[location.pathname]}
        items={items}
        onClick={(info) => navigate(info.key)}
      />
    </div>
  );
};

export default Sidebar;