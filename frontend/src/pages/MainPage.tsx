import Sidebar from '../components/SideBar';
import CommentsPage from './CommentsPage';
import '../styles/MainPage.css';

export default function MainPage() {
  return (
    <div className="main-page">
      <aside className="main-sidebar">
        <Sidebar />
      </aside>
      <main className="main-content">
        <CommentsPage />
      </main>
    </div>
  );
}