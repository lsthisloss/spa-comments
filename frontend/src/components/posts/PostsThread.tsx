import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import { observer } from "mobx-react-lite";
import { postStore } from "../../services/stores/PostStore";
import { useNavigate } from "react-router-dom";
import { navigationStore } from "../../services/stores/NavigationStore";

import { useVirtualItems } from "../../hooks/useVirtualItems";
import { usePostsFeed } from "../../hooks/useFeedItems";
import { NewPostNotification } from "../ui/particles/NewPostNotification";
import MemoizedPostItem from "../ui/optimization/MemoizedPostItem";
import VirtualList, { VirtualListItem } from '../common/VirtualList';
import { Post } from "../../types/interfaces";
import { logger } from "../../utils/Logger";
import { FeedType } from "../../services/stores/PostStore";

interface PostsFeedProps {
  activeTab: string;
  userId?: string; 
}

const PostsThread = observer(({ activeTab, userId }: PostsFeedProps) => {
  const navigate = useNavigate();
  const [, setSocketError] = useState<string | null>(null);
  
  // Refs для отслеживания состояния
  const lastActiveTabRef = useRef(activeTab);
  const hasRestoredScrollRef = useRef(false);
  const initialLoadRef = useRef(false);
  const lastUserIdRef = useRef(userId);
  const lastLoadAttemptRef = useRef<number>(0);
  const lastLoadMoreRef = useRef<number>(0);
  // Вычисляем тип фида и получаем данные
  const { feedType, feed } = useMemo(() => {
    // Проверяем activeTab === "user" ИЛИ наличие userId
    if (activeTab === "user" || userId) {
      logger.log(`[PostsThread] User feed requested for userId: ${userId}, activeTab: ${activeTab}`);
      return {
        feedType: "user" as FeedType,
        feed: postStore.getUserFeed(userId!)
      };
    }
    
    const type: FeedType = activeTab === "all" ? "feed" : "following";
    logger.log(`[PostsThread] Main feed requested, type: ${type}, activeTab: ${activeTab}`);
    return {
      feedType: type,
      feed: postStore.getFeed(type)
    };
  }, [activeTab, userId]);

  const { estimateItemHeight, getItemKey } = usePostsFeed();

// === ВОССТАНОВЛЕНИЕ СКРОЛЛА ПРИ ВОЗВРАТЕ ===
    
  useEffect(() => {
    // Восстановление скролла для обеих лент
    if (feedType === "feed") {
      // Проверяем, пришли ли мы с другой страницы (есть ли сохраненная позиция)
      const savedScrollPosition = navigationStore.feedScrollPosition;
      const hasSavedPosts = postStore.feedSavedPosts.length > 0;
      
      if (savedScrollPosition > 0 && !hasRestoredScrollRef.current && hasSavedPosts) {
        logger.log(`[PostsThread] Restoring main feed scroll position: ${savedScrollPosition} with ${postStore.feedSavedPosts.length} saved posts`);
        
        // Восстанавливаем состояние store
        postStore.onBackToFeed((position) => {
          logger.log(`[PostsThread] Scrolling to position: ${position}`);
          window.scrollTo({ top: position, behavior: 'auto' });
          hasRestoredScrollRef.current = true;
          
          // Устанавливаем флаг, чтобы разрешить дальнейшую загрузку
          initialLoadRef.current = true;
        });
        
        return; // Не загружаем новые посты, используем сохраненные
      }
      
      // ИСПРАВЛЕНИЕ: Проверяем переключение табов vs прямой переход
      if (savedScrollPosition > 0 && !hasSavedPosts) {
        // Если есть позиция скролла но нет сохраненных постов
        // Проверяем, это переключение табов или прямой переход
        const isTabSwitch = feed.list.length > 0; // Если есть посты в ленте - это переключение табов
        
        if (isTabSwitch) {
          logger.log(`[PostsThread] Tab switch detected (scroll=${savedScrollPosition}, posts=${feed.list.length}), restoring scroll position`);
          setTimeout(() => {
            window.scrollTo({ top: savedScrollPosition, behavior: 'auto' });
            hasRestoredScrollRef.current = true;
          }, 100);
          return; // НЕ загружаем новые посты и НЕ сбрасываем позицию
        } else {
          logger.log(`[PostsThread] Direct URL detected (scroll=${savedScrollPosition}, saved=${hasSavedPosts}), will load fresh feed`);
          // Сбрасываем сохраненную позицию скролла только для прямого перехода
          navigationStore.feedScrollPosition = 0;
        }
      }
    } else if (feedType === "following") {
      // Для ленты подписок только восстанавливаем скролл без сохранения постов
      const savedScrollPosition = navigationStore.followingScrollPosition;
      
      if (savedScrollPosition > 0 && !hasRestoredScrollRef.current && feed.list.length >= 0) {
        logger.log(`[PostsThread] Restoring following feed scroll position: ${savedScrollPosition}`);
        setTimeout(() => {
          window.scrollTo({ top: savedScrollPosition, behavior: 'auto' });
          hasRestoredScrollRef.current = true;
        }, 100);
      }
    }
  }, [feedType, feed.list.length]);

  // === СОХРАНЕНИЕ СКРОЛЛА ПРИ УХОДЕ С КОМПОНЕНТА ===

  useEffect(() => {
    const handleBeforeUnload = () => {
      // Сохраняем позицию скролла при уходе со страницы
      navigationStore.saveTabScrollPosition(feedType === 'feed' ? 'all' : 'my');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      // Сохраняем позицию скролла при размонтировании компонента
      const currentScrollPosition = window.scrollY;
      if (currentScrollPosition > 0) {
        navigationStore.saveTabScrollPosition(
          feedType === 'feed' ? 'all' : 'my', 
          currentScrollPosition
        );
      }
    };
  }, [feedType]);
  // Хук для виртуализации списка
  const {
    virtualItems,
    totalHeight,
    measureElement,
  } = useVirtualItems(feed.list, getItemKey, estimateItemHeight);

  // Обработка скролла вниз (включение manual mode)
  const handleScrollDown = useCallback(() => {
    logger.log('[PostsThread] User scrolled down, enabling manual update mode');
    postStore.setManualUpdateMode(feedType, true);
  }, [feedType]);

  // Загрузка следующей страницы
const handleLoadMore = useCallback(() => {
  if (feed.loading || feed.allLoaded) {
    logger.log(`[PostsThread] Skipping loadMore: loading=${feed.loading}, allLoaded=${feed.allLoaded}`);
    return;
  }
  if (!initialLoadRef.current && feed.list.length === 0) {
    logger.log(`[PostsThread] Skipping loadMore: initialLoad=false and no items`);
    return;
  }

  // ИСПРАВЛЕНИЕ: Добавляем дебаунс для предотвращения частых вызовов
  const now = Date.now();
  const lastLoadMore = lastLoadMoreRef.current || 0;
  
  if (now - lastLoadMore < 300) { // 300ms между вызовами loadMore
    logger.log(`[PostsThread] LoadMore debounced (${300 - (now - lastLoadMore)}ms remaining)`);
    return;
  }
  
  lastLoadMoreRef.current = now;

  logger.log(`[PostsThread] Loading more ${feedType} posts, page ${feed.page + 1}, userId: ${userId}`);
  postStore.loadMore(feedType, userId);
}, [feedType, feed.loading, feed.allLoaded, feed.page, userId, initialLoadRef, feed.list.length]);


  // Обработчик загрузки новых постов из буфера
  const handleLoadNewPosts = useCallback(() => {
    if (feed.buffer.length === 0) {
      return;
    }
    
    logger.log(`[PostsThread] Loading ${feed.buffer.length} new posts from buffer`);
    
    // Загружаем посты из буфера в основной список
    postStore.handleLoadNewPosts(feedType);
    
    // Отключаем мануальный режим ТОЛЬКО здесь (по кнопке)
    postStore.setManualUpdateMode(feedType, false);
    
    // Прокручиваем наверх
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [feed.buffer.length, feedType]);

  // Клик по посту с сохранением состояния навигации
  const handleItemClick = useCallback((postId: string) => {
    logger.log(`[PostsThread] Handling click for post ${postId}`);
    
    const currentScrollPosition = window.scrollY;
    
    // Сохраняем состояние в PostStore (только для главной ленты)
    if (feedType === "feed") {
      postStore.saveFeedState(currentScrollPosition);
    }
    
    // Сохраняем состояние навигации
    const navigationState = navigationStore.saveNavigationState('post', postId);
    
    // Переходим на пост с сохраненным state
    navigate(`/post/${postId}`, { 
      state: navigationState 
    });
  }, [navigate, feedType]);

  // === ВОССТАНОВЛЕНИЕ СКРОЛЛА ПРИ ВОЗВРАТЕ ===
    

  // === ОСНОВНАЯ ЛОГИКА ЗАГРУЗКИ ПОСТОВ ===
    useEffect(() => {
    console.log(`[PostsThread DEBUG] Feed state:`, {
      feedType,
      userId,
      feedListLength: feed.list.length,
      loading: feed.loading,
      allLoaded: feed.allLoaded,
      virtualItemsLength: virtualItems.length,
      totalHeight,
      items: feed.list.slice(0, 3).map(p => ({ id: p.id, userName: p.userName })) // Первые 3 поста для проверки
    });
  }, [feedType, userId, feed.list.length, feed.loading, feed.allLoaded, virtualItems.length, totalHeight, feed.list]);

useEffect(() => {
  // Отслеживаем смену типа фида или пользователя
  const feedChanged = feedType !== lastActiveTabRef.current || userId !== lastUserIdRef.current;
  
  if (feedChanged) {
    logger.log(`[PostsThread] Feed changed from ${lastActiveTabRef.current} to ${feedType}, userId: ${lastUserIdRef.current} -> ${userId}`);
    lastActiveTabRef.current = feedType;
    lastUserIdRef.current = userId;
    
    // ИСПРАВЛЕНИЕ: Сбрасываем флаг восстановления скролла при смене фида
    hasRestoredScrollRef.current = false;
    
    // Остальная логика остается без изменений...
    if (feed.list.length === 0 && !feed.loading && !feed.allLoaded) {
      logger.log(`[PostsThread] Starting initial load for ${feedType}${userId ? ` (user: ${userId})` : ''}...`);
      
      if (feed.reset) {
        postStore.clearResetFlag(feedType, userId);
      }
      
      postStore.fetchPosts(feedType, 1, userId).catch(setSocketError);
      initialLoadRef.current = true;
    } else if (feed.allLoaded && feed.total === 0) {
      logger.log(`[PostsThread] ${feedType} feed is empty and fully loaded, skipping initial load`);
    }
    return;
  }

  // ЗАЩИТА: НЕ загружаем если лента пустая но уже все загружено
  if (feed.list.length === 0 && !feed.loading && !feed.reset && !feed.allLoaded && !initialLoadRef.current) {
    // ДОПОЛНИТЕЛЬНАЯ ЗАЩИТА: Проверяем что это не повторный вызов
    if (Date.now() - (lastLoadAttemptRef.current || 0) < 2000) {
      logger.log(`[PostsThread] Skipping load - too soon after last attempt`);
      return;
    }
    
    logger.log(`[PostsThread] Starting initial load for ${feedType}...`);
    lastLoadAttemptRef.current = Date.now();
    postStore.fetchPosts(feedType, 1, userId).catch(setSocketError);
    initialLoadRef.current = true;
  }
  
  // Проверяем reset флаг и загружаем свежие данные
  if (feed.reset && !feed.loading) {
    logger.log(`[PostsThread] Reset flag detected, loading fresh data for ${feedType}${userId ? ` (user: ${userId})` : ''}`);
    
    postStore.clearResetFlag(feedType, userId);
    postStore.fetchPosts(feedType, 1, userId).catch(setSocketError);
    initialLoadRef.current = true;
  }
}, [feedType, userId, feed.list.length, feed.loading, feed.reset, feed.allLoaded, feed.total]);

  const renderPostItem = useCallback((
    virtualItem: VirtualListItem<Post>, 
    measureRef: (el: HTMLElement | null) => void
  ) => {
    return (
      <div
        id={`post-${virtualItem.item.id}`}
        ref={measureRef}
        data-virtual-index={virtualItem.index}
      >
        <MemoizedPostItem 
          post={virtualItem.item}
          onClick={handleItemClick}
          onHeightChange={() => {
            const element = document.getElementById(`post-${virtualItem.item.id}`);
            if (element) {
              measureElement(element, virtualItem.index);
            }
          }}
        />
      </div>
    );
  }, [handleItemClick, measureElement]);

  // === КОМПОНЕНТЫ UI ===

  // Показывать уведомление о новых постах в manual mode (не для пользовательских лент)
  const shouldShowNotification = feed.manualUpdateMode && feed.newPostsCount > 0 && feedType !== "user";
  
  const headerComponent = shouldShowNotification ? (
    <NewPostNotification 
      latestPost={feed.latestPost}
      onFocusPost={() => {}}
      newPostsCount={feed.newPostsCount}
      onLoadNewPosts={handleLoadNewPosts}
      truncateContent={(text: string) => text.length > 50 ? `${text.substring(0, 50)}...` : text}
    />
  ) : null;

  // === ОСНОВНОЙ РЕНДЕР ===
  return (
    <div>
      {headerComponent}
      <VirtualList
        feedContextId={`${feedType}-${userId || 'default'}`}
        items={feed.list}
        renderItem={renderPostItem}
        getItemKey={getItemKey}
        totalHeight={totalHeight}
        virtualItems={virtualItems}
        measureElement={measureElement}
        onEndReached={handleLoadMore}
        loading={feed.loading}
        allLoaded={feed.allLoaded}
        loadingMessage="Loading posts..."
        emptyMessage={feedType === "user" ? "No posts by this user" : "No posts available"}
        className="posts-virtual-list"
        manualMode={feed.manualUpdateMode}
        onScrollDown={handleScrollDown}
        enableManualModeTracking={feedType !== "user"} // Отключаем для пользовательских лент
        initialLoadComplete={initialLoadRef.current}
        endReachedThreshold={1500}
        debugOptions={{
          feedType,
          userId,
          pageNumber: feed.page,
          totalPosts: feed.total,
          bufferSize: feed.buffer.length,
          manualMode: feed.manualUpdateMode,
          newPostsCount: feed.newPostsCount,
          feedListLength: feed.list.length,
          resetFlag: feed.reset,
        }}
      />
    </div>
  );
});

export default PostsThread;