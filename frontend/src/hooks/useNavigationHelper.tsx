import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '../utils/Logger';

/*
  Хук для навигации по приложению.
  Предоставляет функции для перехода к постам, комментариям и профилям пользователей.
  Используется в компонентах для упрощения навигации.
*/
export function useNavigationHelper() {
  const navigate = useNavigate();

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

  const navigateToPost = useCallback((postSlug: string) => {
    logger.log(`[NavigationHelper] Navigating to post: ${postSlug}`);
    navigate(`/post/${postSlug}`);
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
    logger.log(`[NavigationHelper] Going back`);
    navigate(-1);
  }, [navigate]);

  return {
    navigateToPost,
    navigateToProfile,
    navigateToEntity,
    navigateTo,
    goBack,
  };
}