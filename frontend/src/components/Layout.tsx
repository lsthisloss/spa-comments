import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './SideBar';
import '../styles/main.scss';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const activeTab = location.pathname === '/whoami' ? 'Who Am I' : 'Posts';

  const handleTabClick = (tab: string) => {
    if (tab === 'Posts') {
      navigate('/');
    } else if (tab === 'Who Am I') {
      navigate('/whoami');
    }
  };

  return (
    <div className="main-page">
      <aside className="main-sidebar">
        <Sidebar />
      </aside>
      <div className="main-area">
        <div className="tabs">
          <div
            className={`tab ${activeTab === 'Posts' ? 'active-tab' : ''}`}
            onClick={() => handleTabClick('Posts')}
          >
            Posts
          </div>
          <div
            className={`tab ${activeTab === 'Who Am I' ? 'active-tab' : ''}`}
            onClick={() => handleTabClick('Who Am I')}
          >
            Who Am I
          </div>
        </div>
        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}