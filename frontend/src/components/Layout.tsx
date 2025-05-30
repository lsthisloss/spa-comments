import { useLocation } from 'react-router-dom';
import Sidebar from './SideBar';
import '../styles/main.scss';
import { useState } from 'react';
import { logger } from '../utils/Logger';

interface LayoutProps {
  children: (props: { activeTab: 'all' | 'my' }) => React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'all' | 'my'>('all');

  const handleTabClick = (tab: 'all' | 'my') => {
    if (tab === activeTab) return; // Пропускаем если уже активен
    
    logger.log(`Switching tab from ${activeTab} to ${tab}`);
    setActiveTab(tab);
    
  };

  const hideTabs =
    /^\/post\/\w+/.test(location.pathname) ||
    /^\/profile\/\w+/.test(location.pathname) ||
    /^\/auth\/\w+/.test(location.pathname) ||
    /^\/comment\/\w+/.test(location.pathname);

  return (
    <div className="main-page">
      <div className="main-sidebar">
        <Sidebar />
      </div>
      <div className="main-area">
        {!hideTabs && (
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