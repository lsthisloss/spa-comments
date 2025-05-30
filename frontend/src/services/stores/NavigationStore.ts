import { makeAutoObservable, toJS } from "mobx";
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
}

class NavigationStore {
  currentState: NavigationState = { scrollPosition: 0, timestamp: Date.now() };
  
  // Простые позиции скролла
  feedScrollPosition: number = 0;
  followingScrollPosition: number = 0;
  
  constructor() {
    makeAutoObservable(this);
    logger.log("[NAV] Initialized");
  }

  /**
   * Навигация на главную с полной очисткой состояния
   */
  navigateToFreshHome(navigate: NavigateFunction) {
    logger.log("[NAV] Navigating to fresh home - clearing all saved state");
    
    // Очищаем все сохраненные данные ленты
    postStore.feedSavedPosts.clear();
    postStore.feedScrollPosition = 0;
    
    // Очищаем состояние навигации
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
      state.postId = currentPath.split('/').pop();
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

  /**
   * Обрабатывает возврат назад (НЕ используется для клика на Home)
   */
  handleBackNavigation(navigate: NavigateFunction) {
    const state = this.currentState;
    
    logger.log("[NAV] Handling back navigation with state:", toJS(state));
    
    // Если пришли с главной ленты
    if (state.fromFeed) {
      logger.log("[NAV] Returning to main feed");
      navigate('/', { replace: true });
      
      // Проверяем, есть ли сохраненные посты (значит пришли с ленты)
      const hasSavedPosts = postStore.feedSavedPosts.length > 0;
      
      if (hasSavedPosts) {
        // Есть сохраненные посты - восстанавливаем позицию скролла
        logger.log("[NAV] Restoring saved feed state and scroll position");
        this.restoreScrollPosition(this.feedScrollPosition);
      } else {
        // Нет сохраненных постов - значит пришли по прямому URL, загружаем свежую ленту
        logger.log("[NAV] No saved posts found, loading fresh feed");
        setTimeout(() => {
          postStore.fetchPosts('feed', 1);
        }, 100);
      }
      return;
    }
    
    // Если пришли с ленты подписок
    if (state.fromFollowing) {
      logger.log("[NAV] Returning to following feed");
      navigate('/?tab=following', { replace: true });
      this.restoreScrollPosition(this.followingScrollPosition);
      return;
    }
    
    // Если пришли из профиля - идем на главную с СВЕЖЕЙ лентой
    if (state.fromUserProfile) {
      logger.log("[NAV] Returning from profile to main feed - loading fresh");
      this.navigateToFreshHome(navigate);
      return;
    }
    
    // Если пришли с поста - возвращаемся к посту
    if (state.fromPost && state.postId) {
      logger.log(`[NAV] Returning to post ${state.postId}`);
      navigate(`/post/${state.postId}`, { replace: true });
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
  private restoreScrollPosition(position: number) {
    if (position <= 0) return;
    
    setTimeout(() => {
      window.scrollTo({ top: position, behavior: 'auto' });
      logger.log(`[NAV] Restored scroll position: ${position}`);
    }, 1);
  }

  /**
   * Очищает состояние
   */
  clearState() {
    this.currentState = { scrollPosition: 0, timestamp: Date.now() };
  }
}

export const navigationStore = new NavigationStore();