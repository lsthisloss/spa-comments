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
  // Обрабатываем вкладки только на главной странице
  if (location.pathname !== '/') {
    return;
  }
  
  const searchParams = new URLSearchParams(location.search);
  const tabFromUrl = searchParams.get('tab');
  const newTab = tabFromUrl === 'following' ? 'my' : 'all';
  
  if (activeTab !== newTab) {
    logger.log(`[Layout] Syncing tab with URL: ${newTab}`);
    setActiveTab(newTab);
    navigationStore.setActiveTab(newTab);
  }
}, [location.search, location.pathname, navigationStore]);

const handleTabClick = (tab: 'all' | 'my') => {
  if (tab === activeTab) {
    // If user clicks on active tab, scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    logger.log(`[Layout] Active tab ${tab} clicked, scrolling to top`);
    return;
  }

  logger.log(`[Layout] Switching tab from ${activeTab} to ${tab}`);
  
  // Save scroll position for current tab
  navigationStore.saveTabScrollPosition(activeTab);
  
  // Switch tab
  setActiveTab(tab);
  navigationStore.setActiveTab(tab);
  
  // Update URL
  const newUrl = tab === 'my' ? '/?tab=following' : '/';
  window.history.pushState({ preserveFeeds: true }, '', newUrl); // Add preserveFeeds flag
  
  // Restore scroll position for new tab
  setTimeout(() => {
    const restored = navigationStore.restoreTabScrollPosition(tab);
    if (!restored) {
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