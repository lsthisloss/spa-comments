import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import MainPage from './pages/MainPage';
import CommentsPage from './pages/CommentsPage';
import './App.scss';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<MainPage />} />
          <Route path="/post/:postId" element={<CommentsPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}