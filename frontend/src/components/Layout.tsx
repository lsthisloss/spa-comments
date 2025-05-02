import Sidebar from './SideBar';
import '../styles/Layout.css';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="main-page">
      <aside className="main-sidebar">
        <Sidebar />
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
}