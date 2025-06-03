import { useLocation } from 'react-router-dom';
import Sidebar from './SideBar';
import '../styles/main.scss';
import { useState, useEffect } from 'react';
import { logger } from '../utils/Logger';
import { useNavigationStore } from '../hooks/useStore';
interface LayoutProps {
  children: (props: { activeTab: 'all' | 'my' }) => React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'all' | 'my'>('all');
  const navigationStore = useNavigationStore();

  // Инициализация вкладки из URL
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const tabFromUrl = searchParams.get('tab');
    
    if (tabFromUrl === 'following') {
      setActiveTab('my');
      navigationStore.setActiveTab('my');
    } else {
      setActiveTab('all');
      navigationStore.setActiveTab('all');
    }
  }, [location.search, navigationStore]);

  const handleTabClick = (tab: 'all' | 'my') => {
  if (tab === activeTab) {
    // Если пользователь кликает на активный таб, прокручиваем страницу к началу
    window.scrollTo({ top: 0, behavior: 'smooth' });
    logger.log(`[Layout] Active tab ${tab} clicked, scrolling to top`);
    return;
  }

  logger.log(`[Layout] Switching tab from ${activeTab} to ${tab}`);
  
  // Сохраняем позицию скролла
  navigationStore.saveTabScrollPosition(activeTab);
  
  // Переключаем вкладку
  setActiveTab(tab);
  navigationStore.setActiveTab(tab);
  
  // Обновляем URL
  const newUrl = tab === 'my' ? '/?tab=following' : '/';
  window.history.pushState({}, '', newUrl);
  
  // Восстанавливаем позицию скролла для новой вкладки
  setTimeout(() => {
    const restored = navigationStore.restoreTabScrollPosition(tab);
    if (!restored) {
      // Если нет сохраненной позиции - скроллим в начало
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, 100);
};

const showTabs = location.pathname === '/';

return (
  <div className="main-page">
    <div className="main-sidebar">
      <Sidebar />
    </div>
    <div className="main-area">
      {showTabs && (
        <div className="tabs">
          <div
            className={`tab ${activeTab === 'all' ? 'active-tab' : ''}`}
            onClick={() => handleTabClick('all')}
          >
            Feed
          </div>
          <div
            className={`tab ${activeTab === 'my' ? 'active-tab' : ''}`}
            onClick={() => handleTabClick('my')}
          >
            Following
          </div>
        </div>
      )}
      <main className="main-content">
        {children({ activeTab })}
      </main>
    </div>
  </div>
);
}