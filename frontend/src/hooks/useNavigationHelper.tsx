import { useCallback, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { logger } from '../utils/Logger';

interface NavigationState {
  from: string;
  fromComment: boolean;
}

export function useNavigationHelper() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Сохраняем состояние при инициализации
  const initialStateRef = useRef<NavigationState | null>(null);
  const navigationInProgressRef = useRef(false);

  // Захватываем состояние при первой загрузке компонента
  useEffect(() => {
    const currentState = location.state as NavigationState | null;
    if (currentState && !initialStateRef.current) {
      initialStateRef.current = currentState;
      logger.log(`[NavigationHelper] Captured initial state:`, currentState);
    }
  }, [location.state]);

  const navigateToEntity = useCallback((type: 'post' | 'comment', identifier: string) => {
    if (!identifier) {
      logger.error(`[NavigationHelper] Cannot navigate to ${type} without identifier`);
      return;
    }

    let path = '';
    if (type === 'post') {
      path = `/post/${identifier}`;
    } else if (type === 'comment') {
      path = `/comment/${identifier}`;
    }

    logger.log(`[NavigationHelper] Navigating to ${type}: ${identifier}`);
    navigate(path);
  }, [navigate]);

  const navigateToPost = useCallback((postSlug: string, fromComment = false) => {
    const navigationState: NavigationState = {
      from: location.pathname,
      fromComment,
    };
    
    logger.log(`[NavigationHelper] Navigating to post: ${postSlug}`, navigationState);
    navigate(`/post/${postSlug}`, { state: navigationState });
  }, [navigate, location]);

  // Используем сохраненное состояние
  const smartGoBack = useCallback(() => {
    if (navigationInProgressRef.current) {
      logger.log(`[NavigationHelper] Navigation already in progress, ignoring call`);
      return;
    }

    navigationInProgressRef.current = true;

    // Используем сохраненное состояние вместо текущего
    const stateToUse = initialStateRef.current || (location.state as NavigationState | null);
    
    logger.log(`[NavigationHelper] SmartGoBack with state:`, stateToUse);

    try {
      if (stateToUse?.fromComment) {
        logger.log(`[NavigationHelper] Smart back: skipping comment page`);
        navigate(-2);
      } else {
        logger.log(`[NavigationHelper] Normal back navigation`);
        navigate(-1);
      }
    } finally {
      setTimeout(() => {
        navigationInProgressRef.current = false;
        // чищаем сохраненное состояние после использования
        initialStateRef.current = null;
        logger.log(`[NavigationHelper] Navigation lock released`);
      }, 500);
    }
  }, [navigate, location.state]);

  const navigateToProfile = useCallback((username: string) => {
    logger.log(`[NavigationHelper] Navigating to profile ${username}`);
    navigate(`/profile/${username}`);
  }, [navigate]);

  const navigateTo = useCallback((path: string) => {
    logger.log(`[NavigationHelper] Navigating to: ${path}`);
    navigate(path);
  }, [navigate]);

  const goBack = useCallback(() => {
    smartGoBack();
  }, [smartGoBack]);

  return {
    navigateToPost,
    navigateToProfile,
    navigateToEntity,
    navigateTo,
    goBack,
    smartGoBack,
  };
}