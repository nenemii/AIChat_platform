// src/components/Sidebar.tsx
import styles from './Sidebar.module.css';
import menu from '../../src/assets/menu.png'
import { Link, useLocation } from 'react-router-dom';

// 定义菜单项类型
interface SidebarMenuItem {
  id: number;
  title: string;
  icon: React.ReactNode; // 可替换为实际图标（如 Ant Design Icon）
  path: string;
}

interface SidebarProps {
  menuExpend: boolean; // 侧边栏展开状态
  setMenuExpend: (expanded: boolean) => void; // 切换侧边栏的函数
}
const Sidebar = ({ menuExpend, setMenuExpend }: SidebarProps) => {

const location = useLocation();

const currentPath = location.pathname;


  // 选中的菜单


  // 菜单数据
  const menuItems: SidebarMenuItem[] = [
    { id: 1, title: '首页', icon: <div>pa</div>, path: '/' },
    { id: 2, title: '聊天', icon: <div>💬</div>, path: '/chat' },
    { id: 3, title: '历史', icon: <div>📜</div>, path: '/history' },
    { id: 4, title: '设置', icon: <div>⚙️</div>, path: '/setting' },
  ];


  return (
    <div className={menuExpend?styles.sidebar:styles.smallSidebar}>
      {/* 侧边栏 Logo */}
      <div className={styles.logo}>{menuExpend ? 'AI 聊天助手' : ''}
        <div className='menu-icon' onClick={()=>setMenuExpend(menuExpend===true?false:true)}>
          <img src={menu} alt="" />
        </div>
      </div>


      
      {/* 菜单列表 */}
      <ul className={menuExpend?styles.menuList:styles.noMenuList}>
        {menuItems.map((item) => (
          <li key={item.id}>
          
            
            <Link to={item.path}
              className={ `
          ${styles.menuItemBase} 
          
          ${currentPath === item.path ? styles.activeMenuItem : ''}
        `}
        >
            {menuExpend && <span className={styles.menuIcon}>{item.icon}</span>}
            {menuExpend && <span className={styles.menuTitle}>{item.title}</span>} 
          </Link>

          </li>
          
        ))}
      </ul>
    </div>
  );
};

export default Sidebar;