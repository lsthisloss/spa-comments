import { useLocation } from 'react-router-dom';
import Sidebar from './SideBar';
import '../../styles/main.scss';
import { useTabs } from '../../hooks/useTabs';

/*
  Компонент Layout, который оборачивает основную часть приложения.
  Содержит боковую панель и верхнюю навигацию с вкладками.
  Используется для отображения контента в зависимости от активной вкладки.
*/
interface LayoutProps {
  children: (props: { activeTab: 'all' | 'my' }) => React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { activeTab, handleTabClick } = useTabs();

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