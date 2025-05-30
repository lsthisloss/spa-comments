import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import { observer } from "mobx-react-lite";
import { postStore } from "../../services/stores/PostStore";
import { Empty } from "antd";
import { useNavigate } from "react-router-dom";
import { socketStore } from "../../services/stores/SocketStore";
import { CheckCircleOutlined } from "@ant-design/icons";
import { navigationStore } from "../../services/stores/NavigationStore";

import { useVirtualItems } from "../../hooks/useVirtualItems";
import { usePostsFeed } from "../../hooks/useFeedItems";
import { LoadingIndicator } from "../ui/particles/LoadingIndicator";
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
  const [socketError, setSocketError] = useState<string | null>(null);
  
  // Refs для отслеживания состояния
  const lastActiveTabRef = useRef(activeTab);
  const hasRestoredScrollRef = useRef(false);
  const initialLoadRef = useRef(false);

  // Вычисляем тип фида и получаем данные
  const { feedType, feed } = useMemo(() => {
    if (userId) {
      return {
        feedType: "user" as FeedType,
        feed: postStore.getUserFeed(userId)
      };
    }
    
    const type: FeedType = activeTab === "all" ? "feed" : "following";
    return {
      feedType: type,
      feed: postStore.getFeed(type)
    };
  }, [activeTab, userId]);

  const { estimateItemHeight, getItemKey } = usePostsFeed();

  // Хук для виртуализации списка
  const {
    virtualItems,
    totalHeight,
    measureElement,
  } = useVirtualItems(feed.list, getItemKey, estimateItemHeight);

  // === КОЛБЭКИ ДЛЯ VIRTUALIST ===
  
  // Обработка скролла к верху (отключение manual mode)
  const handleScrollToTop = useCallback(() => {
    logger.log('[PostsThread] User scrolled to top, disabling manual update mode');
    postStore.setManualUpdateMode(feedType, false);
  }, [feedType]);

  // Обработка скролла вниз (включение manual mode)
  const handleScrollDown = useCallback(() => {
    logger.log('[PostsThread] User scrolled down, enabling manual update mode');
    postStore.setManualUpdateMode(feedType, true);
  }, [feedType]);

  // Загрузка следующей страницы
  const handleLoadMore = useCallback(() => {
    if (feed.loading || feed.allLoaded || !initialLoadRef.current) {
      logger.log(`[PostsThread] Skipping loadMore: loading=${feed.loading}, allLoaded=${feed.allLoaded}, initialLoad=${initialLoadRef.current}`);
      return;
    }

    logger.log(`[PostsThread] Loading more ${feedType} posts, page ${feed.page + 1}`);
    postStore.loadMore(feedType, userId);
  }, [feedType, feed.loading, feed.allLoaded, feed.page, userId, initialLoadRef]);

  // Обработчик загрузки новых постов из буфера
  const handleLoadNewPosts = useCallback(() => {
    if (feed.buffer.length === 0) {
      return;
    }
    
    logger.log(`[PostsThread] Loading ${feed.buffer.length} new posts from buffer`);
    
    // Загружаем посты из буфера в основной список
    postStore.handleLoadNewPosts(feedType);
    
    // Отключаем мануальный режим
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
    
  useEffect(() => {
    // Проверяем, пришли ли мы с другой страницы (есть ли сохраненная позиция)
    const savedScrollPosition = navigationStore.feedScrollPosition;
    const hasSavedPosts = postStore.feedSavedPosts.length > 0;
    
    if (savedScrollPosition > 0 && !hasRestoredScrollRef.current && feedType === "feed" && hasSavedPosts) {
      logger.log(`[PostsThread] Restoring scroll position: ${savedScrollPosition} with ${postStore.feedSavedPosts.length} saved posts`);
      
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
    
    // Если нет сохраненных постов, но есть позиция скролла - значит это прямой переход
    if (savedScrollPosition > 0 && !hasSavedPosts && feedType === "feed") {
      logger.log(`[PostsThread] Direct URL detected (scroll=${savedScrollPosition}, saved=${hasSavedPosts}), will load fresh feed`);
      // Сбрасываем сохраненную позицию скролла
      navigationStore.feedScrollPosition = 0;
    }
  }, [feedType]);

  // === ОСНОВНАЯ ЛОГИКА ЗАГРУЗКИ ПОСТОВ ===
  
  useEffect(() => {
    const tabChanged = lastActiveTabRef.current !== activeTab;
    
    if (tabChanged) {
      logger.log(`[PostsThread] Tab changed from ${lastActiveTabRef.current} to ${activeTab}, resetting feed state`);
      lastActiveTabRef.current = activeTab;
      hasRestoredScrollRef.current = false;
      initialLoadRef.current = false;
      postStore.resetFeedState(feedType, userId);
    }

    // Проверяем изменение feedType отдельно
    const feedTypeChanged = userId ? feedType !== "user" : (feedType === "user");
    
    if (feedTypeChanged) {
      logger.log(`[PostsThread] Feed type changed to ${feedType}, resetting state`);
      hasRestoredScrollRef.current = false;
      initialLoadRef.current = false;
      postStore.resetFeedState(feedType, userId);
    }

    // Проверяем, нужно ли загружать посты
    const hasRestoredState = navigationStore.feedScrollPosition > 0 && feedType === "feed" && !hasRestoredScrollRef.current;
    const shouldLoad = !feed.loading && feed.list.length === 0 && !hasRestoredState && !initialLoadRef.current;
    
    if (!shouldLoad) {
      if (feed.reset) {
        postStore.clearResetFlag(feedType);
      }
      return;
    }

    logger.log(`[PostsThread] Starting initial load for ${feedType}...`);
    initialLoadRef.current = true;

    const loadPosts = async () => {
      try {
        if (!socketStore.posts?.connected) {
          setSocketError("Connecting to server...");
          await socketStore.waitForPostsSocket?.(5000);
        }

        await postStore.fetchPosts(feedType, 1, userId);
        
        setSocketError(null);
      } catch (error) {
        setSocketError(error instanceof Error ? error.message : "[PostsThread] Failed to load posts");
      }
    };

    loadPosts();
  }, [feedType, userId, feed.list.length, feed.loading, feed.reset, activeTab]);

  // === РЕНДЕР ФУНКЦИИ ===

  // Рендер элемента поста
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

  // Показывать уведомление о новых постах в manual mode
  const shouldShowNotification = feed.manualUpdateMode && feed.newPostsCount > 0;
  
  // Заголовок с уведомлением о новых постах
  const headerComponent = shouldShowNotification ? (
    <NewPostNotification 
      latestPost={feed.latestPost}
      onFocusPost={() => {}}
      newPostsCount={feed.newPostsCount}
      onLoadNewPosts={handleLoadNewPosts}
      truncateContent={(text: string) => text.length > 50 ? `${text.substring(0, 50)}...` : text}
    />
  ) : null;

  // === СОСТОЯНИЯ ЗАГРУЗКИ И ОШИБОК ===

  // Показываем ошибку подключения сокета
  if (socketError) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#ff4d4f' }}>
        <p>{socketError}</p>
      </div>
    );
  }

  // Если идет загрузка и нет постов
  if (feed.loading && feed.list.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <LoadingIndicator 
          loading={true}
          allLoaded={false}
          hasItems={false}
          onVisible={() => {}}
          emptyMessage={`Loading ${feedType} posts...`}
        />
      </div>
    );
  }

  // Если нет постов после загрузки
  if (!feed.loading && feed.list.length === 0) {
    return (
      <Empty 
        description={feedType === "following" ? "No posts from users you follow" : "No posts available"} 
        style={{ margin: "60px auto" }} 
      />
    );
  }

  // === ОСНОВНОЙ РЕНДЕР ===

  return (
    <div>
      {headerComponent}
      <VirtualList<Post>
        items={feed.list}
        virtualItems={virtualItems}
        totalHeight={totalHeight}
        renderItem={renderPostItem}
        getItemKey={(item) => getItemKey(item)}
        measureElement={measureElement}
        onEndReached={handleLoadMore}
        endReachedThreshold={1500}
        loading={feed.loading}
        allLoaded={feed.allLoaded}
        manualMode={feed.manualUpdateMode}
        enableManualModeTracking={true}
        onScrollToTop={handleScrollToTop}
        onScrollDown={handleScrollDown}
        // ДОБАВЬТЕ новый проп
        initialLoadComplete={initialLoadRef.current}
        loadingIndicator={
          <LoadingIndicator 
            loading={feed.loading}
            allLoaded={feed.allLoaded}
            hasItems={feed.list.length > 0}
            onVisible={() => {}}
            emptyMessage="🎉 You've reached the end!"
            emptyIcon={<CheckCircleOutlined />}
            itemCount={feed.total}
          />
        }
        emptyComponent={
          <Empty description="No posts available" style={{ margin: "60px auto" }} />
        }
        debugOptions={{
          manualMode: feed.manualUpdateMode,
          bufferSize: feed.buffer.length,
          newPostsCount: feed.newPostsCount,
          currentPage: feed.page,
          totalPosts: feed.total,
          isCustomLoading: feed.loading
        }}
      />
    </div>
  );
});

export default PostsThread;