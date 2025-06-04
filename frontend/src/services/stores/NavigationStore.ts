import { action, makeAutoObservable, toJS } from "mobx";
import { logger } from "../../utils/Logger";
import { NavigateFunction } from "react-router-dom";

/**
 * Типы значений, которые могут храниться в контексте навигации
 */
export type NavigationContextValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | { [key: string]: NavigationContextValue }
  | NavigationContextValue[];

/**
 * Тип для контекста навигации
 */
export interface NavigationContext {
  pageType?: 'feed' | 'post' | 'comment' | 'profile';
  feedType?: 'main' | 'following' | 'user';
  entityId?: string;
  userId?: string;
  userSlug?: string; // Слаг пользователя
  postId?: string;       // ID связанного поста
  postSlug?: string;     // Слаг связанного поста
  commentId?: string;    // ID связанного комментария
  isPostParent?: boolean; // Флаг, указывающий что это родительский пост
  scrollPosition?: number;
  timestamp?: number;
  [key: string]: NavigationContextValue | undefined;
}

/**
 * Представляет точку в истории навигации
 */
export interface NavigationPoint {
  path: string;               // Полный путь
  timestamp: number;          // Время создания
  scrollPosition: number;     // Позиция скролла
  context?: NavigationContext; // Типизированный контекст
}

/**
 * Современное хранилище навигации без жесткой привязки к типам страниц
 */
class NavigationStore {
  // История навигации как стек
  private navigationStack: NavigationPoint[] = [];

  // Карта позиций скролла по путям
  private scrollPositions = new Map<string, number>();

  // Добавляем карту для позиций скролла вкладок
  private tabScrollPositions = new Map<string, number>();

  // Публичные свойства для прямого доступа (для обратной совместимости)
  feedScrollPosition: number = 0;
  followingScrollPosition: number = 0;

  // Публичные свойства для внутренних компонентов
  activeTab: 'all' | 'my' = 'all';

  constructor() {
    makeAutoObservable(this);
    logger.log("[NAV] Initialized universal navigation system");
  }

  /**
   * Получает предыдущую точку навигации
   */
  getPreviousPoint = (): NavigationPoint | undefined => {
    if (this.navigationStack.length <= 1) return undefined;
    return this.navigationStack[this.navigationStack.length - 2];
  };
  /**
   * Устанавливает активную вкладку
   */
  setActiveTab = action((tab: 'all' | 'my') => {
    logger.log(`[NAV] Setting active tab: ${tab}`);
    this.activeTab = tab;
  });

  /**
   * Сохраняет позицию скролла для вкладки
   */
  saveTabScrollPosition = action((tab: 'all' | 'my', position?: number) => {
    const scrollPosition = position !== undefined ? position : window.scrollY;
    logger.log(`[NAV] Saving scroll position for tab ${tab}: ${scrollPosition}px`);
    this.tabScrollPositions.set(tab, scrollPosition);

    // Обновляем также свойства для прямого доступа
    if (tab === 'all') {
      this.feedScrollPosition = scrollPosition;
    } else if (tab === 'my') {
      this.followingScrollPosition = scrollPosition;
    }
  });

  /**
   * Восстанавливает позицию скролла для вкладки
   * @returns true если позиция была восстановлена, false если нет сохраненной позиции
   */
  restoreTabScrollPosition = action((tab: 'all' | 'my'): boolean => {
    const position = this.tabScrollPositions.get(tab);

    if (position !== undefined) {
      logger.log(`[NAV] Restoring scroll position for tab ${tab}: ${position}px`);
      window.scrollTo({ top: position, behavior: 'auto' });

      // Обновляем свойства для прямого доступа (обратная совместимость)
      if (tab === 'all') {
        this.feedScrollPosition = position;
      } else if (tab === 'my') {
        this.followingScrollPosition = position;
      }

      return true;
    }

    logger.log(`[NAV] No saved scroll position for tab ${tab}`);
    return false;
  });

  /**
   * Восстанавливает позицию скролла для пути
   */
  restoreScrollPosition = action((path: string): boolean => {
    const position = this.scrollPositions.get(path);

    if (position !== undefined) {
      logger.log(`[NAV] Restoring scroll for ${path}: ${position}px`);
      setTimeout(() => window.scrollTo({ top: position, behavior: 'auto' }), 50);
      return true;
    }

    logger.log(`[NAV] No saved scroll for ${path}`);
    return false;
  });


  pushNavigationPoint = action((
    path: string,
    context?: NavigationContext,
    scrollPosition?: number
  ): NavigationPoint => {
    // Используем переданную или текущую позицию скролла
    const position = scrollPosition ?? window.scrollY;

    // Создаем точку навигации
    const point: NavigationPoint = {
      path,
      timestamp: Date.now(),
      scrollPosition: position,
      context
    };

    // Сохраняем позицию скролла
    this.scrollPositions.set(path, position);

    // Проверяем последнюю точку
    const lastPoint = this.navigationStack.length > 0
      ? this.navigationStack[this.navigationStack.length - 1]
      : null;

    // : НЕ заменяем посты и комментарии, только одинаковые пути
    const shouldReplace = lastPoint &&
      lastPoint.path === path &&
      !path.startsWith('/post/') &&
      !path.startsWith('/comment/') &&
      !path.startsWith('/profile/');

    if (shouldReplace) {
      this.navigationStack[this.navigationStack.length - 1] = point;
      logger.log(`[NAV] Updated navigation point for ${path}`, toJS(point));
    } else {
      // Добавляем в стек
      this.navigationStack.push(point);
      logger.log(`[NAV] Added navigation point for ${path}`, toJS(point));
    }

    // Ограничиваем размер стека
    if (this.navigationStack.length > 20) {
      this.navigationStack.shift();
    }

    logger.log(`[NAV] Stack now has ${this.navigationStack.length} items:`,
      this.navigationStack.map(p => p.path));

    return point;
  });

  /**
   * Возвращает назад, с контекстным пониманием навигации
   */
  goBack = action((navigate: NavigateFunction): void => {
    // Распечатаем весь стек для отладки
    logger.log("[NAV] Current navigation stack:", toJS(this.navigationStack));
    logger.log("[NAV] Stack paths:", this.navigationStack.map(p => p.path));
    logger.log("[NAV] Current path:", window.location.pathname);

    // Если в стеке меньше 2 точек, просто идем назад
    if (this.navigationStack.length < 2) {
      logger.log("[NAV] No history, using browser back");
      navigate(-1);
      return;
    }

    const currentPath = window.location.pathname;
    const isCurrentComment = currentPath.startsWith('/comment/');
    const isCurrentProfile = currentPath.startsWith('/profile/') || currentPath.startsWith('/user/');

    // Обрабатываем комментарии И профили
    if (isCurrentComment) {
      logger.log("[NAV] Current page is comment, searching for parent post");

      // Ищем родительский пост среди всех точек в стеке (БЕЗ удаления)
      for (let i = this.navigationStack.length - 1; i >= 0; i--) {
        const point = this.navigationStack[i];

        logger.log(`[NAV] Checking point ${i}:`, {
          path: point.path,
          pageType: point.context?.pageType,
          isPostParent: point.context?.isPostParent
        });

        // Если точка - это пост или помечена как родительский пост
        if (point.path.startsWith('/post/') ||
          (point.context && point.context.pageType === 'post') ||
          (point.context && point.context.isPostParent)) {

          logger.log(`[NAV] Found parent post in history, returning to: ${point.path}`);

          // ТЕПЕРЬ удаляем все точки после найденного поста
          this.navigationStack.splice(i + 1);

          // Создаем безопасный сериализуемый контекст
          const safeState = {
            path: point.path,
            scrollPosition: point.scrollPosition,
            isBackNavigation: true,
            fromPath: currentPath
          };

          // Навигация к посту
          navigate(point.path, {
            replace: true,
            state: safeState
          });

          // Восстанавливаем позицию скролла
          setTimeout(() => {
            this.restoreScrollPosition(point.path);
          }, 100);

          return;
        }
      }

      logger.log("[NAV] No parent post found in history, using standard navigation");
    }

    // Если мы на странице профиля, ищем родительский пост или комментарий
    if (isCurrentProfile) {
      logger.log("[NAV] Current page is profile, searching for parent post/comment");

      // Ищем родительский пост или комментарий
      for (let i = this.navigationStack.length - 1; i >= 0; i--) {
        const point = this.navigationStack[i];

        logger.log(`[NAV] Checking point ${i}:`, {
          path: point.path,
          pageType: point.context?.pageType,
          isPostParent: point.context?.isPostParent
        });

        // Если точка - это пост, комментарий или помечена как родительский элемент
        if (point.path.startsWith('/post/') ||
          point.path.startsWith('/comment/') ||
          (point.context && (point.context.pageType === 'post' || point.context.pageType === 'comment')) ||
          (point.context && point.context.isPostParent)) {

          logger.log(`[NAV] Found parent ${point.context?.pageType || 'page'} in history, returning to: ${point.path}`);

          // Удаляем все точки после найденного родителя
          this.navigationStack.splice(i + 1);

          const safeState = {
            path: point.path,
            scrollPosition: point.scrollPosition,
            isBackNavigation: true,
            fromPath: currentPath
          };

          navigate(point.path, {
            replace: true,
            state: safeState
          });

          setTimeout(() => {
            this.restoreScrollPosition(point.path);
          }, 100);

          return;
        }
      }

      logger.log("[NAV] No parent post/comment found for profile, using standard navigation");
    }

    // Стандартная навигация для других случаев
    // Удаляем текущую точку из стека
    const removedPoint = this.navigationStack.pop();
    logger.log("[NAV] Removed point:", removedPoint?.path);

    // Получаем предыдущую точку для возврата
    const previousPoint = this.navigationStack[this.navigationStack.length - 1];

    logger.log(`[NAV] Standard navigation back to: ${previousPoint.path}`);

    const safeState = {
      path: previousPoint.path,
      scrollPosition: previousPoint.scrollPosition,
      isBackNavigation: true,
      fromPath: currentPath
    };

    navigate(previousPoint.path, {
      replace: true,
      state: safeState
    });

    // Восстанавливаем позицию скролла
    setTimeout(() => {
      this.restoreScrollPosition(previousPoint.path);
    }, 100);
  });

  findPointWithProperty = (key: string, value: NavigationContextValue): NavigationPoint | undefined => {
    logger.log(`[NAV] Searching for point with ${key}=${value}`);

    for (let i = this.navigationStack.length - 1; i >= 0; i--) {
      const point = this.navigationStack[i];
      if (point.context && point.context[key] === value) {
        logger.log(`[NAV] Found point with ${key}=${value} at path: ${point.path}`);
        return point;
      }
    }

    logger.log(`[NAV] No point found with ${key}=${value}`);
    return undefined;
  };

  /**
   * Создает контекст пути для текущего URL
   */
  getPathContext(): NavigationContext {
    const path = window.location.pathname;
    const segments = path.split('/').filter(Boolean);

    // Базовый контекст
    const context: NavigationContext = {};

    // Определение типа страницы из пути
    if (path === '/' || path === '') {
      const searchParams = new URLSearchParams(window.location.search);
      const tab = searchParams.get('tab');

      context.pageType = 'feed';
      context.feedType = tab === 'following' ? 'following' : 'main';
    }
    else if (segments[0] === 'post' && segments[1]) {
      context.pageType = 'post';
      context.entityId = segments[1];
    }
    else if (segments[0] === 'comment' && segments[1]) {
      context.pageType = 'comment';
      context.entityId = segments[1];
    }
    else if (segments[0] === 'user' && segments[1]) {
      context.pageType = 'profile';
      context.userSlug = segments[1];
    }
    // support for /profile/:slug
    else if (segments[0] === 'profile' && segments[1]) {
      context.pageType = 'profile';
      context.userSlug = segments[1];
    }

    return context;
  }

  /**
   * Очищает историю навигации
   */
  clearHistory = action(() => {
    this.navigationStack = [];
    logger.log("[NAV] Navigation history cleared");
  });
}

export default NavigationStore;