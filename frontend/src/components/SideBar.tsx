import { Menu } from 'antd';
import { HomeOutlined, LoginOutlined, LogoutOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import '../styles/main.scss';
import { XIcon } from './ui/particles/XIcon';
import { observer } from 'mobx-react-lite';
import { logger } from '../utils/Logger';
import { SearchModal } from './ui/modals/SearchModal';
import { usePostStore, useUserStore, useAuthStore } from '../hooks/useStore';

const Sidebar = observer(() => {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const postStore = usePostStore();
  const userStore = useUserStore();
  const authStore = useAuthStore();
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
      key: '/profile', // Используем /profile без параметра для собственного профиля
      icon: <UserOutlined className="sidebar-icon" />,
      label: 'Me',
    },
    {
      key: 'search',
      icon: <SearchOutlined className="sidebar-icon" />,
      label: 'Search',
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
    <>
      <nav className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <Menu
          mode="inline"
          className="sidebar-menu"
          items={menuItems}
          selectedKeys={[location.pathname]}
          onClick={({ key }) => {
            if (key === 'search') {
              setSearchOpen(true);
            } else if (key === '/' || key === '/x') {
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
      <SearchModal visible={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
});

export default Sidebar;