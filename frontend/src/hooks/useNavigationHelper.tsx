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
  const navigateToEntity = useCallback((
    entityType: 'post' | 'comment' | 'profile', 
    entityId: string
  ) => {
    logger.log(`[NavigationHelper] Navigating to ${entityType}: ${entityId}`);
    
    let path = '';
    const context: NavigationContext = { entityId };
    
    // Определяем путь в зависимости от типа сущности
    switch (entityType) {
      case 'post':
        path = `/post/${entityId}`;
        context.pageType = 'post';
        break;
      case 'comment':
        path = `/comment/${entityId}`;
        context.pageType = 'comment';
        break;
      case 'profile':
        path = `/profile/${entityId}`;
        context.pageType = 'profile';
        context.userId = entityId;
        break;
      default:
        logger.error(`[NavigationHelper] Unknown entity type: ${entityType}`);
        return;
    }
    
    // Используем общий метод для навигации
    navigateTo(path, context);
  }, [navigateTo]);
  
  /**
   * Навигация назад с пониманием контекста
   */
  const goBack = useCallback(() => {
    navigationStore.goBack(navigate);
  }, [navigate, navigationStore]);

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
/**
 * Навигация к профилю пользователя
 */
const navigateToProfile = useCallback((userId: string) => {
  if (!userId) {
    logger.warn('[NavigationHelper] Cannot navigate to profile with empty user ID');
    return;
  }

  logger.log(`[NavigationHelper] Navigating to profile: ${userId}`);
  
  // Сохраняем текущий путь перед переходом
  const currentPath = location.pathname + location.search;
  const currentContext = navigationStore.getPathContext();
  
  // Всегда сохраняем текущую точку в историю
  navigationStore.pushNavigationPoint(currentPath, currentContext);
  
  // Создаем контекст для профиля
  const profileContext: NavigationContext = {
    pageType: 'profile',
    userId: userId,
  };
  
  // Сохраняем информацию о родительском посте/комментарии, если есть
  if (currentPath.startsWith('/post/')) {
    profileContext.postId = currentPath.split('/').pop();
    profileContext.isPostParent = true; // Маркируем что пост является родителем
  }
  else if (currentPath.startsWith('/comment/')) {
    const commentId = currentPath.split('/').pop();
    profileContext.commentId = commentId;
  }
  
  // ИСПОЛЬЗУЕМ navigateTo вместо прямого navigate
  navigateTo(`/profile/${userId}`, profileContext);
}, [location, navigateTo, navigationStore]);

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