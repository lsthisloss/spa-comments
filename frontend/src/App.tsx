import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/ui/Layout';
import MainPage from './pages/MainPage';
import UserProfilePage from './pages/UserProfilePage';
import AuthPage from './pages/AuthPage';
import { observer } from 'mobx-react';
import PostPage from './pages/PostPage';
import CommentPage from './pages/CommentPage';
import ErrorBoundary from './components/ui/ErrorBoundary';
import { logger } from "./utils/Logger";
import { appInitializer } from './services/main/AppInitializer';
import { Spin } from 'antd';
import { useUserStore, useAuthStore } from './hooks/useStore';
import { StoresProvider } from './contexts/StoresContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationProvider } from './hooks';

// QueryClient конфигурация
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 минут
      refetchOnWindowFocus: false,
      retry: 3,
    },
  },
});

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

/*
  Основной контент приложения, обернутый в провайдеры и роуты.
  Здесь происходит инициализация приложения, проверка авторизации и рендеринг страниц.
*/
const AppContent = observer(() => {
  const [isInitialized, setIsInitialized] = useState(false);
  const userStore = useUserStore();
  const authStore = useAuthStore();


  /*
    Инициализация ID сессии при первой загрузке или перезагрузке страницы.
    Сохраняем ID в sessionStorage и глобальную переменную для дальнейшего использования.
  */
  useEffect(() => {
    const sessionKey = 'app_session_id';
    const previousSessionId = sessionStorage.getItem(sessionKey);
    const newSessionId = Date.now().toString();

    // Сохраняем ID в глобальной переменной
    window.APP_INIT_TIME = newSessionId;

    if (!previousSessionId) {
      // Первая загрузка приложения
      sessionStorage.setItem(sessionKey, newSessionId);
      logger.log(`[App] First initialization with session ID: ${newSessionId}`);
    } else {
      // Перезагрузка страницы
      logger.log(`[App] Page reload detected: old session=${previousSessionId}, new session=${newSessionId}`);

      sessionStorage.setItem(sessionKey, newSessionId);

      // Устанавливаем флаг перезагрузки в истории браузера
      history.replaceState(
        {
          ...history.state,
          pageReload: true,
          scrollPosition: 0,
          reloadTimestamp: newSessionId
        },
        document.title
      );

      logger.log(`[App] Cleared all snapshots after page reload`);
    }
  }, []);

  /*
    Эффект инициализации приложения.
    Проверяем наличие токена пользователя и синхронизируем с хранилищем авторизации.
    Если пользователь не найден, загружаем его по ID из хранилища авторизации.
    После успешной инициализации вызываем метод инициализации приложения.
  */
  useEffect(() => {
    if (isInitialized) return;

    const initApp = async () => {
      try {
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

        logger.log("[App] Waiting for AppInitializer to complete...");
        await appInitializer.initialize();

        setIsInitialized(true);
        logger.log("[App] App initialization completed");
      } catch (error) {
        logger.error("[App] Initialization error:", error);
      }
    };

    initApp();
  }, [authStore, isInitialized, userStore]);

  if (appInitializer.error) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <h2>Failed to initialize application</h2>
        <p style={{ color: 'red' }}>{appInitializer.error.message}</p>
        <button
          onClick={() => appInitializer.manualRetry()}
          style={{
            padding: '8px 16px',
            background: '#1890ff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginTop: '16px'
          }}
        >
          Retry Connection
        </button>
      </div>
    );
  }

  //
  return (
    <ErrorBoundary>
      {appInitializer.initialized && !appInitializer.socketsReady && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          backgroundColor: '#fff2e8',
          borderBottom: '1px solid #ffbb96',
          padding: '8px 16px',
          textAlign: 'center',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <span style={{ color: '#fa541c' }}>🔌</span>
          <span style={{ marginLeft: '8px' }}>Server connection lost. Some features will be limited.</span>
          <button
            onClick={() => appInitializer.manualRetry()}
            style={{
              marginLeft: '16px',
              padding: '4px 12px',
              background: '#fa541c',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Reconnect
          </button>
        </div>
      )}

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
                  appInitializer.initialized ? (
                    <Routes>
                      <Route path="/" element={<MainPage {...props} />} />
                      <Route path="/profile" element={<UserProfilePage />} />
                      <Route path="/profile/:username" element={<UserProfilePage />} />
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

const App = () => {
  return (
   <QueryClientProvider client={queryClient}>
      <StoresProvider>
        <NavigationProvider>
          <AppContent />
        </NavigationProvider>
      </StoresProvider>
    </QueryClientProvider>
  );
};

export default App;