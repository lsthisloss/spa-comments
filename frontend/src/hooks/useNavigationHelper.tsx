import { useCallback, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { logger } from '../utils/Logger';

interface NavigationState {
  from: string;
  fromComment: boolean;
  commentChain?: string[];
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

      const currentState = location.state as NavigationState | null;
      const currentChain = currentState?.commentChain || [];

      // Добавляем текущий путь в цепочку, если это комментарий
      if (location.pathname.startsWith('/comment/')) {
        currentChain.push(location.pathname);
      }

      const navigationState: NavigationState = {
        from: location.pathname,
        fromComment: true,
        commentChain: currentChain,
      };

      logger.log(`[NavigationHelper] Navigating to ${type} with chain:`, { identifier, chain: currentChain });
      navigate(path, { state: navigationState });
      return;
    }

    logger.log(`[NavigationHelper] Navigating to ${type}: ${identifier}`);
    navigate(path);
  }, [navigate, location]);

  const navigateToPost = useCallback((postSlug: string, fromComment = false) => {
    const currentState = location.state as NavigationState | null;

    const navigationState: NavigationState = {
      from: location.pathname,
      fromComment,
      commentChain: fromComment && currentState?.commentChain ? currentState.commentChain : undefined,
    };

    logger.log(`[NavigationHelper] Navigating to post: ${postSlug}`, navigationState);
    navigate(`/post/${postSlug}`, { state: navigationState });
  }, [navigate, location]);

  const smartGoBack = useCallback(() => {
    if (navigationInProgressRef.current) {
      logger.log(`[NavigationHelper] Navigation already in progress, ignoring duplicate call`);
      return;
    }

    navigationInProgressRef.current = true;

    logger.log(`[NavigationHelper] Simple back navigation`);
    navigate(-1);

    setTimeout(() => {
      navigationInProgressRef.current = false;
      logger.log(`[NavigationHelper] Navigation lock released`);
    }, 300);

  }, [navigate]);

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