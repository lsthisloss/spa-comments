import { action, makeAutoObservable, toJS } from "mobx";
import { logger } from "../../utils/Logger";
import { postStore } from "./PostStore";
import { NavigateFunction } from "react-router-dom";

export interface NavigationState {
  scrollPosition: number;
  fromFeed?: boolean;
  fromFollowing?: boolean;
  fromUserProfile?: boolean;
  userId?: string;
  fromPost?: boolean;
  postId?: string;
  timestamp?: number;
  navigationType?: string;
  slug?: string;
  preserveFeeds?: boolean;
  commentId?: string;
  fromComment?: boolean;
}


class NavigationStore {
  currentState: NavigationState = { scrollPosition: 0, timestamp: Date.now() };
  
  // Позиции скролла
  feedScrollPosition: number = 0;
  followingScrollPosition: number = 0;
  
  // Отслеживание активной вкладки
  currentActiveTab: 'all' | 'my' = 'all';
  
  constructor() {
    makeAutoObservable(this);
    logger.log("[NAV] Initialized");
  }


  /**
   * Сохраняет состояние перед навигацией
   */
/**
 * Сохраняет состояние перед навигацией
 */
saveNavigationState(navigationType?: string, targetId?: string, previousState?: NavigationState): NavigationState {
  const scrollPosition = window.scrollY;
  const currentPath = window.location.pathname;
  const searchParams = new URLSearchParams(window.location.search);
  const tab = searchParams.get('tab');
  
  const state: NavigationState = {
    scrollPosition,
    timestamp: Date.now(),
    // Сохраняем предыдущее состояние если есть
    ...(previousState || {})
  };
  
  // Определяем откуда переходим
  if (currentPath === '/' || currentPath === '') {
    if (tab === 'following') {
      state.fromFollowing = true;
      this.followingScrollPosition = scrollPosition;
    } else {
      state.fromFeed = true;
      this.feedScrollPosition = scrollPosition;
    }
  } else if (currentPath.includes('/profile/')) {
    state.fromUserProfile = true;
    state.userId = currentPath.split('/').pop();
  } else if (currentPath.includes('/post/')) {
    state.fromPost = true;
    // Берем slug из URL
    const urlSlug = currentPath.split('/').pop();
    state.postId = urlSlug;
    // Также сохраняем slug отдельно
    state.slug = urlSlug;
  } else if (currentPath.includes('/comment/')) {
    // Добавляем поддержку для комментариев
    state.fromComment = true; // Установите флаг откуда пришли
    const urlSlug = currentPath.split('/').pop();
    state.commentId = urlSlug;
  }
  
  // Сохраняем переданный targetId и тип навигации
  if (navigationType === 'post') {
    state.postId = targetId;
    state.slug = targetId;
  } else if (navigationType === 'comment') {
    state.commentId = targetId;
    state.slug = targetId;
  } else if (targetId) {
    state.slug = targetId;
  }
  
  // Сохраняем тип навигации
  if (navigationType) {
    state.navigationType = navigationType;
  }
  
  this.currentState = state;
  logger.log(`[NAV] Saved state for ${navigationType || 'navigation'} to ${targetId}:`, toJS(state));
  
  return toJS(state);
}

  /**
   * Получить сериализованное состояние для передачи в navigate
   */
  getSerializedState(): NavigationState {
    return toJS(this.currentState);
  }

  saveTabScrollPosition = action((tab: 'all' | 'my', scrollPosition?: number) => {
    const position = scrollPosition ?? window.scrollY;
    
    if (tab === 'all') {
      this.feedScrollPosition = position;
      logger.log(`[NAV] Saved feed scroll position: ${position}`);
    } else {
      this.followingScrollPosition = position;
      logger.log(`[NAV] Saved following scroll position: ${position}`);
    }
  });

  /**
   * Обновление активной вкладки
   */
  setActiveTab = action((tab: 'all' | 'my') => {
    if (this.currentActiveTab !== tab) {
      logger.log(`[NAV] Active tab changed from ${this.currentActiveTab} to ${tab}`);
      this.currentActiveTab = tab;
    }
  });

  /**
   * Очистка позиций скролла вкладок
   */
  clearTabScrollPositions = action(() => {
    logger.log("[NAV] Clearing all tab scroll positions");
    this.feedScrollPosition = 0;
    this.followingScrollPosition = 0;
  });

  // Обновляем существующий метод navigateToFreshHome
  navigateToFreshHome(navigate: NavigateFunction) {
    logger.log("[NAV] Navigating to fresh home - clearing all saved state");
    
    // Очищаем все сохраненные данные ленты
    postStore.feedSavedPosts.clear();
    postStore.feedScrollPosition = 0;
    
    // Очищаем состояние навигации И позиции вкладок
    this.feedScrollPosition = 0;
    this.followingScrollPosition = 0;
    this.currentState = { scrollPosition: 0, timestamp: Date.now() };
    
    // Переходим на главную
    navigate('/', { replace: true });
    
    // Загружаем свежую ленту
    setTimeout(() => {
      logger.log("[NAV] Loading fresh feed");
      postStore.fetchPosts('feed', 1);
    }, 100);
  }

  // Обновляем handleBackNavigation для поддержки вкладок
  handleBackNavigation(navigate: NavigateFunction) {
    const state = this.currentState;
    
    logger.log("[NAV] Handling back navigation with state:", toJS(state));

      // Если пришли с комментария и есть postId, переходим на пост
    if (state.fromComment && state.postId) {
      logger.log(`[NAV] Returning from comment to post ${state.postId}`);
      
      // Создаем новое состояние для страницы поста, сохраняя исходный контекст
      const postState = {
        ...state,
        fromComment: false, // Обнуляем флаг, что пришли с комментария
        commentId: undefined // Очищаем ID комментария
      };
      
      navigate(`/post/${state.postId}`, { 
        replace: true,
        state: postState // Передаем обновленное состояние
      });
      return;
    }
    // Если пришли с главной ленты
    if (state.fromFeed) {
      logger.log("[NAV] Returning to main feed");
      navigate('/', { replace: true });
      
      if (state.preserveFeeds) {
        logger.log("[NAV] Preserving feed state - not loading fresh data");
        setTimeout(() => {
          this.restoreTabScrollPosition('all');
        }, 100);
      } else {
        // Проверяем, есть ли сохраненные посты (значит пришли с ленты)
        const hasSavedPosts = postStore.feedSavedPosts.length > 0;
        
        if (hasSavedPosts) {
          // Есть сохраненные посты - восстанавливаем позицию скролла
          logger.log("[NAV] Restoring saved feed state and scroll position");
          setTimeout(() => {
            this.restoreTabScrollPosition('all');
          }, 100);
        } else {
          // Нет сохраненных постов - значит пришли по прямому URL, загружаем свежую ленту
          logger.log("[NAV] No saved posts found, loading fresh feed");
          setTimeout(() => {
            postStore.fetchPosts('feed', 1);
          }, 100);
        }
      }
      return;
    }
    
    // Если пришли с ленты подписок
    if (state.fromFollowing) {
      logger.log("[NAV] Returning to following feed");
      navigate('/?tab=following', { replace: true });
      
      if (!state.preserveFeeds) {
        setTimeout(() => {
          this.restoreTabScrollPosition('my');
        }, 100);
      }
      return;
    }
    
    
    if (state.fromUserProfile) {
      logger.log("[NAV] Returning from profile to main feed - loading fresh");
      this.navigateToFreshHome(navigate);
      return;
    }
    
    if (state.fromPost && state.postId) {
      logger.log(`[NAV] Returning to post ${state.slug}`);
      navigate(`/post/${state.slug}`, { replace: true });
      return;
    }
    
    // По умолчанию - назад
    navigate(-1);
  }

  saveStateFromLocation(locationState: Partial<NavigationState>) {
    if (locationState && typeof locationState === 'object') {
      this.currentState = {
        ...this.currentState,
        ...locationState,
        timestamp: Date.now()
      };
      logger.log("[NAV] State saved from location:", toJS(this.currentState));
    }
  }

  clearCurrentState() {
    this.currentState = { scrollPosition: 0, timestamp: Date.now() };
  }

  /**
   * Получает состояние для прямого URL (если пользователь перешел по прямой ссылке)
   */
  getStateForDirectUrl(pathname: string): NavigationState | null {
    // Для прямых переходов создаем базовое состояние
    if (pathname.includes('/post/')) {
      return {
        scrollPosition: 0,
        fromFeed: true, // По умолчанию считаем что пришли с главной ленты
        timestamp: Date.now()
      };
    }
    
    if (pathname.includes('/profile/')) {
      return {
        scrollPosition: 0,
        fromFeed: true,
        timestamp: Date.now()
      };
    }
    
    return null;
  }

  /**
   * Восстанавливает позицию скролла
   */
restoreTabScrollPosition = action((tab: 'all' | 'my') => {
  const position = tab === 'all' ? this.feedScrollPosition : this.followingScrollPosition;
  
  if (position > 0) {
    logger.log(`[NAV] Restoring ${tab} scroll position: ${position}`);
    
    // Более надежное восстановление с повторными попытками
    let attempts = 0;
    const maxAttempts = 3;
    
    const attemptRestore = () => {
      attempts++;
      
      // Проверяем, что страница достаточно прогрузилась
      const hasContent = document.body.scrollHeight > position;
      
      if (hasContent || attempts >= maxAttempts) {
        this.restoreScrollPosition(position);
        return true;
      } else {
        // Если контент еще не прогрузился, пробуем еще раз через 100ms
        setTimeout(attemptRestore, 100);
        return false;
      }
    };
    
    return attemptRestore();
  }
  return false;
});

/**
 * Восстанавливает позицию скролла
 */
private restoreScrollPosition(position: number) {
  if (position <= 0) return;
  
  // Более надежное восстановление
  const restore = () => {
    window.scrollTo({ top: position, behavior: 'auto' });
    logger.log(`[NAV] Restored scroll position: ${position}`);
    
    // Проверяем, что скролл действительно установился
    setTimeout(() => {
      const currentScroll = window.scrollY;
      const tolerance = 50; // Допускаем погрешность в 50px
      
      if (Math.abs(currentScroll - position) > tolerance) {
        logger.log(`[NAV] Scroll position not accurate (${currentScroll} vs ${position}), retrying...`);
        window.scrollTo({ top: position, behavior: 'auto' });
      }
    }, 50);
  };
  
  // Небольшая задержка для завершения рендера
  setTimeout(restore, 10);
}

  /**
   * Очищает состояние
   */
  clearState() {
    this.currentState = { scrollPosition: 0, timestamp: Date.now() };
  }
}

export const navigationStore = new NavigationStore();