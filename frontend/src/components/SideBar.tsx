import { Menu } from 'antd';
import { HomeOutlined, LoginOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import '../styles/main.scss';
import { XIcon } from './ui/particles/XIcon';
import userStore from '../services/stores/UserStore';
import authStore from '../services/stores/AuthStore';
import { postStore } from '../services/stores/PostStore';
import { observer } from 'mobx-react-lite';
import { logger } from '../utils/Logger';

const Sidebar = observer(() => {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed] = useState(false);

  // Функция для навигации на главную с очисткой состояния
  const navigateToHome = () => {
    logger.log('[Sidebar] Navigating to home - clearing saved state and loading fresh feed');
    
    // Очищаем все сохраненные данные
    postStore.feedSavedPosts.clear();
    postStore.feedScrollPosition = 0;
    
    // Переходим на главную
    navigate('/', { replace: true });
    
    // Загружаем свежую ленту
    setTimeout(() => {
      postStore.fetchPosts('feed', 1);
    }, 100);
  };

const menuItems = [
  {
    key: '/x',
    icon: <XIcon className="sidebar-icon" />,
    label: '',
    className: 'x-menu-item',
  },
  { 
    key: '/', 
    icon: <HomeOutlined className="sidebar-icon" />, 
    label: 'Home',
  },
  userStore.user && {
    key: userStore.user ? `/profile/${userStore.user.id}` : '',
    icon: <UserOutlined className="sidebar-icon" />,
    label: 'Me',
  },
  userStore.user
    ? {
        key: 'logout',
        icon: <LogoutOutlined className="sidebar-icon" />,
        label: 'Out',
      }
    : {
        key: 'login',
        icon: <LoginOutlined className="sidebar-icon" />,
        label: 'In',
      },
].filter(Boolean);

return (
  <nav className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
    <Menu
      mode="inline"
      className="sidebar-menu"
      items={menuItems}
      selectedKeys={[location.pathname]}
      onClick={({ key }) => {
        if (key === '/' || key === '/x') {
          navigateToHome();
        } else if (key === 'logout') {
          authStore.logout();
          userStore.setUser(null);
          navigate('/auth');
        } else if (key === 'login') {
          navigate('/auth');
        } else {
          navigate(key);
        }
      }}
    />
  </nav>
);

  return (
    <nav className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <Menu
        mode="inline"
        className="sidebar-menu"
        items={menuItems}
        selectedKeys={[location.pathname]}
        onClick={({ key }) => {
          // Для главной страницы используем специальную функцию
          if (key === '/' || key === '/x') {
            navigateToHome();
          } else {
            navigate(key);
          }
        }}
      />
    </nav>
  );
});

export default Sidebar;