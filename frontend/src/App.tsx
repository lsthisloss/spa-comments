import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import MainPage from './pages/MainPage';
import CommentsPage from './pages/CommentsPage';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          {/* Главная страница */}
          <Route path="/" element={<MainPage />} />
          {/* Страница конкретного поста */}
          <Route path="/post/:postId" element={<CommentsPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}