import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import MainPage from './pages/MainPage';
import WhoAmIPage from './pages/WhoAmIPage';
import './App.scss';
import NestedCommentsPage from './pages/NestedCommentsPage';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<MainPage />} />
          <Route path="/whoami" element={<WhoAmIPage />} />
          <Route path="/post/:parentId" element={<NestedCommentsPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}