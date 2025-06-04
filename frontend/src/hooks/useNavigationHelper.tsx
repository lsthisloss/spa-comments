import { useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { logger } from '../utils/Logger';
import { useNavigationStore } from './useStore';
import { NavigationContext } from '../services/stores/NavigationStore';

/**
 * Hook для унифицированной навигации по приложению
 */
export function useNavigationHelper() {
  const navigate = useNavigate();
  const location = useLocation();
  const navigationStore = useNavigationStore();

  /**
   * Универсальная навигация к странице с сохранением контекста
   */
  const navigateTo = useCallback((path: string, context?: NavigationContext) => {
  logger.log(`[NavigationHelper] Navigating to: ${path}`);
  
  // Сохраняем текущую позицию в истории
  const currentPath = location.pathname + location.search;
  const currentContext = navigationStore.getPathContext();
  
  // Создаем точку в истории
  navigationStore.pushNavigationPoint(currentPath, currentContext);
  
  // Простой сериализуемый объект
  const safeContext = context ? {
    pageType: context.pageType,
    feedType: context.feedType,
    entityId: context.entityId,
    userId: context.userId
  } : undefined;
  
  // Навигация с упрощенным контекстом
  navigate(path, { 
    state: { 
      path: currentPath,
      scrollPosition: window.scrollY,
      timestamp: Date.now(),
      context: safeContext 
    } 
  });
}, [navigate, location, navigationStore]);

  /**
   * Навигация к определенному типу сущности (пост, комментарий и т.д.)
   */
 // Add logging to the navigateToEntity function
const navigateToEntity = useCallback((type: 'post' | 'comment' | 'user', id: string, onClick?: (id: string) => void) => {
  logger.log(`[NavigationHelper] Navigating to ${type} with id ${id}`);
  
  // If a click handler is provided, call it and let it handle navigation
  if (onClick) {
    logger.log(`[NavigationHelper] Using provided onClick handler for ${type}`);
    onClick(id);
    return;
  }
  
  // Otherwise, handle navigation directly
  const path = type === 'user' 
    ? `/user/${id}` 
    : type === 'post' 
      ? `/post/${id}` 
      : `/comment/${id}`;
  
  logger.log(`[NavigationHelper] Navigating to path: ${path}`);
  navigateTo(path, {
    from: location.pathname,
    timestamp: Date.now()
  });
}, [navigateTo, location]);
  /**
   * Навигация к посту
   */
  const navigateToPost = useCallback((postSlug: string) => {
    navigateToEntity('post', postSlug);
  }, [navigateToEntity]);

/**
 * Навигация к комментарию
 */
const navigateToComment = useCallback((commentSlug: string, postSlug?: string) => {
  logger.log(`[NavigationHelper] Navigating to comment: ${commentSlug}, post: ${postSlug || 'unknown'}`);
  
  // Сохраняем текущий путь перед переходом к комментарию
  const currentPath = location.pathname + location.search;
  
  // ВАЖНО: Всегда сохраняем текущую страницу в стек с правильным контекстом
  if (currentPath.startsWith('/post/')) {
    const postId = currentPath.split('/').pop();
    
    // Сохраняем текущий пост как точку с маркером родителя
    navigationStore.pushNavigationPoint(currentPath, {
      pageType: 'post',
      entityId: postId,
      isPostParent: true  // Это ключевой флаг для правильной навигации назад
    });
    
    logger.log(`[NavigationHelper] Saved parent post: ${postId} with isPostParent=true`);
  } else {
    // В других случаях просто сохраняем текущую точку
    navigationStore.pushNavigationPoint(currentPath, navigationStore.getPathContext());
  }
  
  // Используем navigateTo для единообразия
  navigateTo(`/comment/${commentSlug}`, {
    pageType: 'comment',
    entityId: commentSlug,
    postSlug: postSlug
  });
}, [location, navigateTo, navigationStore]);

const navigateToProfile = useCallback((userSlug: string) => {
  if (!userSlug) {
    logger.warn('[NavigationHelper] Cannot navigate to profile with empty user slug');
    return;
  }

  logger.log(`[NavigationHelper] Navigating to profile: ${userSlug}`);
  
  // Save the current path before navigation
  const currentPath = location.pathname + location.search;
  const currentContext = navigationStore.getPathContext();
  
  // Always save the current point in history with special marker
  const updatedContext = { ...currentContext, returnToAfterProfile: true };
  navigationStore.pushNavigationPoint(currentPath, updatedContext);
  logger.log(`[NavigationHelper] Saved return point with marker: ${currentPath}`);
  
  // Create context for the profile with correct typing
  const profileContext: NavigationContext = {
    pageType: 'profile',
    userSlug: userSlug, // Use userSlug instead of userId
    returnPath: currentPath
  };
  
  // Use navigateTo for consistency - navigate by slug
  navigateTo(`/user/${userSlug}`, profileContext);
}, [location, navigateTo, navigationStore]);

const goBack = useCallback(() => {
  const currentPath = location.pathname;
  logger.log(`[NavigationHelper] goBack called from path: ${currentPath}`);
  
  // Special handling for returning from profile
  if (currentPath.startsWith('/user/')) {
    const point = navigationStore.findPointWithProperty('returnToAfterProfile', true);
    if (point) {
      logger.log(`[NavigationHelper] Found special return point: ${point.path}`);
      navigate(point.path, { 
        state: { 
          scrollPosition: point.scrollPosition,
          skipFetch: true, // Use skipFetch instead of preserveFeeds
          timestamp: Date.now()
        } 
      });
      return;
    }
  }
  
  // Default behavior
  navigationStore.goBack(navigate);
}, [navigate, location, navigationStore]);
  /**
   * Восстановление позиции скролла
   */
  const restoreScroll = useCallback((path?: string) => {
    navigationStore.restoreScrollPosition(path || location.pathname);
  }, [location.pathname, navigationStore]);

  return {
    navigateTo,
    goBack,
    navigateToPost,
    navigateToComment,
    navigateToProfile,
    restoreScroll,
    navigateToEntity
  };
}