import { Menu } from 'antd';
import { HomeOutlined, LoginOutlined, LogoutOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import '../../styles/main.scss';
import { XIcon } from './particles/XIcon';
import { observer } from 'mobx-react-lite';
import { logger } from '../../utils/Logger';
import { SearchModal } from './modals/SearchModal';
import { useUserStore, useAuthStore } from '../../hooks/useStore';
import useNavigation from '../../hooks/useNavigation';
/*
  Компонент боковой панели (Sidebar) с навигацией по приложению.
  Содержит меню для перехода к различным разделам, включая домашнюю страницу,
  профиль пользователя и поиск. Используется в основном макете приложения.
*/
const Sidebar = observer(() => {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  
  const navigationHelper = useNavigation();
  const userStore = useUserStore();
  const authStore = useAuthStore();
  
  // Функция для навигации на главную с очисткой состояния
  const navigateToHome = () => {
    logger.log('[Sidebar] Navigating to home - loading fresh feed');
    
    // Простая навигация на главную
    navigate('/', {
      state: {
        forceRefresh: true
      }
    });
  };

  // Обработчик для перехода к профилю через SideBar
  const navigateToProfile = () => {
  const currentUser = userStore.user;
  if (!currentUser) return;
  
  const userSlug = currentUser.userName || currentUser.slug || 'unknown';
  
  logger.log(`[Sidebar] Menu item clicked: /profile`);
  logger.log(`[Sidebar] Navigating to own profile: ${userSlug}`);
  
  navigate(`/profile/${userSlug}`);
};
  
  const handleMenuClick = ({ key }: { key: string }) => {
    logger.log(`[Sidebar] Menu item clicked: ${key}`);
    
    switch (key) {
      case 'search':
        setSearchOpen(true);
        break;
      case '/':
      case '/x':
        navigateToHome();
        break;
      case '/profile':
        navigateToProfile();
        break;
      case 'logout':
        authStore.logout();
        userStore.setUser(null);
        navigate('/auth');
        break;
      case 'login':
        navigate('/auth');
        break;
      default:
        navigationHelper.navigateTo(key);
        break;
    }
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
      key: '/profile',
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
          onClick={handleMenuClick}
        />
      </nav>
      <SearchModal visible={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
});

export default Sidebar;