import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import MainPage from './pages/MainPage';
import UserProfilePage from './pages/UserProfilePage';
import AuthPage from './pages/AuthPage';
import { observer } from 'mobx-react';
import PostPage from './pages/PostPage';
import CommentPage from './pages/CommentPage';
import ErrorBoundary from './components/ErrorBoundary';
import { logger } from "./utils/Logger";
import { appInitializer } from './services/AppInitializer';
import { Spin } from 'antd';
import { useUserStore, useAuthStore } from './hooks/useStore';
import { StoresProvider } from './contexts/StoresContext';

// Компонент проверки авторизации с использованием хуков
const RequireAuth = observer(({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const userStore = useUserStore();
  
  logger.log('[App] Current user in mobx:', userStore.user);
  
  if (!userStore.user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }
  
  return <>{children}</>;
});

// Компонент для гостей с использованием хуков
const OnlyGuest = observer(({ children }: { children: React.ReactNode }) => {
  const userStore = useUserStore();
  
  if (userStore.user) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
});

// Основной компонент приложения
const AppContent = observer(() => {
  const [, setInitChecked] = useState(false);
  const userStore = useUserStore();
  const authStore = useAuthStore();

  useEffect(() => {
    logger.log('[AppContent] Component mounted');
    return () => {
      logger.log('[AppContent] Component unmounting');
    };
  }, []);

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
  }, [authStore, userStore]);

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

  // НОВЫЙ ПОДХОД: ВСЕГДА РЕНДЕРИМ РОУТЫ + OVERLAY
  return (
    <ErrorBoundary>
      {/* OVERLAY ПОВЕРХ РОУТОВ */}
      {appInitializer.initialized && !appInitializer.socketsReady && (
        <div style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <Spin size="large" />
          <p style={{ marginTop: 16 }}>Connecting to server...</p>
        </div>
      )}
      
      {/* РОУТЫ ВСЕГДА РЕНДЕРЯТСЯ */}
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
                      appInitializer.initialized && appInitializer.socketsReady ? (
                        <Routes>
                          <Route path="/" element={<MainPage {...props} />} />
                          <Route path="/profile" element={<UserProfilePage />} />
                          <Route path="/user/:username" element={<UserProfilePage />} />
                          <Route path="/post/:slug" element={<PostPage />} />
                          <Route path="/comment/:slug" element={<CommentPage />} />
                          <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                      ) : (
                        <div style={{ padding: '20px', textAlign: 'center' }}>
                          <Spin size="large" />
                          <p>Initializing...</p>
                        </div>
                      )
                    )}
                  </Layout>
                </RequireAuth>
              }
            />
          </Routes>
    </ErrorBoundary>
  );
});

// Корневой компонент с провайдером хранилищ
const App = () => {
  return (
    <StoresProvider>
      <AppContent />
    </StoresProvider>
  );
};

export default App;