import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import MainPage from './pages/MainPage';
import UserProfilePage from './pages/UserProfilePage';
import AuthPage from './pages/AuthPage';
import { observer } from 'mobx-react';
import userStore from './services/stores/UserStore';
import PostPage from './pages/PostPage';
import CommentPage from './pages/CommentPage';
import ErrorBoundary from './components/ErrorBoundary';
import { logger } from "./utils/Logger";
import authStore from './services/stores/AuthStore';
import { appInitializer } from './services/AppInitializer';
import { Spin } from 'antd';

const RequireAuth = observer(({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  logger.log('[App] Current user in mobx:', userStore.user);
  if (!userStore.user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }
  return <>{children}</>;
});

const OnlyGuest = observer(({ children }: { children: React.ReactNode }) => {
  if (userStore.user) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
});

const App = observer(() => {
  const [, setInitChecked] = useState(false);

  useEffect(() => {
    const initApp = async () => {
      // Синхронизация authStore <-> userStore
      if (userStore.user?.token && !authStore.token) {
        authStore.syncWithUserStore({
          id: userStore.user.id,
          token: userStore.user.token,
          userName: userStore.user.userName
        });
      }
      if (!userStore.user && authStore.token && authStore.userId) {
        logger.log("[App] No user in userStore, but token exists. Loading user...");
        const user = await userStore.getUserById(authStore.userId);
        if (user) userStore.setUser(user);
      }
      await appInitializer.initialize().catch(err => {
        logger.error("[App] Failed to initialize application:", err);
      });
      setInitChecked(true);
    };
    initApp();
  }, []);

  // Показываем лоадер, пока не закончилась проверка инициализации

  // Показываем сообщение об ошибке, если инициализация не удалась
  if (appInitializer.error) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <h2>Failed to initialize application</h2>
        <p style={{ color: 'red' }}>{appInitializer.error.message}</p>
        <button onClick={() => window.location.reload()}>Reload</button>
      </div>
    );
  }

  // Показываем ожидание готовности сокетов
  if (appInitializer.initialized && !appInitializer.socketsReady) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh' 
      }}>
        <Spin size="large" />
        <p style={{ marginTop: 16 }}>Connecting to server...</p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Routes>
        <Route
          path="/auth"
          element={
            <OnlyGuest>
              <Layout>{() => <AuthPage />}</Layout>
            </OnlyGuest>
          }
        />
        <Route
          path="/*"
          element={
            <RequireAuth>
              <Layout>
                {(props) => (
                  <Routes>
                    <Route path="/" element={<MainPage {...props} />} />
                    <Route path="/profile/:userId" element={<UserProfilePage />} />
                    <Route path="/post/:postId" element={<PostPage />} />
                    <Route path="/comment/:commentId" element={<CommentPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                )}
              </Layout>
            </RequireAuth>
          }
        />
      </Routes>
    </ErrorBoundary>
  );
});

export default App;