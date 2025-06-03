import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import { observer } from "mobx-react-lite";
import { useVirtualItems } from "../../hooks/useVirtualItems";
import { usePostsFeed } from "../../hooks/useFeedItems";
import { NewPostNotification } from "../ui/particles/NewPostNotification";
import MemoizedPostItem from "../ui/optimization/MemoizedPostItem";
import VirtualList, { VirtualListItem } from '../common/VirtualList';
import { Post } from "../../types/interfaces";
import { logger } from "../../utils/Logger";
import { usePostStore, useUserStore, useNavigationStore } from "../../hooks/useStore";
import { FeedType } from "../../types/enums";
import { useNavigationHelper } from "../../hooks/useNavigationHelper";
interface PostsFeedProps {
  activeTab: string;
  userId?: string; 
}

const PostsThread = observer(({ activeTab, userId: propsUserId }: PostsFeedProps) => {
  const [, setSocketError] = useState<string | null>(null);
  const postStore = usePostStore();
  const userStore = useUserStore();
  const navigationStore = useNavigationStore();
  const navigationHelper = useNavigationHelper();

  const actualUserId = propsUserId || userStore.user?.id;
  
  const hasRestoredScrollRef = useRef(false);
  const stableUserId = useMemo(() => actualUserId, [actualUserId]);
  const isLoadingRef = useRef(false);

  // Определяем тип ленты и получаем состояние
  const { feedType, feed } = useMemo(() => {
    if (activeTab === "user") {
      if (!actualUserId) {
        logger.log(`[PostsThread] Warning: user tab requested but no userId provided`);
        return {
          feedType: "user" as FeedType,
          feed: postStore.getFeed("feed")
        };
      }
      
      return {
        feedType: "user" as FeedType,
        feed: postStore.getUserFeedState()
      };
    }
    
    const type: FeedType = activeTab === "all" ? "feed" : "following";
    logger.log(`[PostsThread] Main feed requested, type: ${type}, activeTab: ${activeTab}`);
    return {
      feedType: type,
      feed: postStore.getFeed(type)
    };
  }, [activeTab, actualUserId, postStore]);

  // Переключение пользователя (только для user feed)
  useEffect(() => {
    if (feedType === "user" && stableUserId) {
      postStore.switchToUser(stableUserId);
    }
  }, [feedType, stableUserId, postStore]);

  // Загрузка данных - с защитой от дублирования
  useEffect(() => {
    // Защита от дублирования
    if (isLoadingRef.current) {
      logger.log(`[PostsThread] Load already in progress, skipping`);
      return;
    }

    // Проверки
    if (feed.loading) {
      logger.log(`[PostsThread] Skipping load - another load in progress`);
      return;
    }
    
    if (feed.list.length > 0 && !feed.reset) {
      logger.log(`[PostsThread] Already loaded ${feed.list.length} posts for ${feedType}, skipping`);
      return;
    }
    
    // Для user feed проверяем userId
    if (feedType === "user") {
      if (!stableUserId) {
        logger.log(`[PostsThread] User feed requested but no userId available`);
        return;
      }
      
      // Проверяем что userId совпадает
      if (postStore.getUserFeedState().userId !== stableUserId) {
        logger.log(`[PostsThread] Waiting for user feed to switch to ${stableUserId}`);
        return;
      }
    }
    
    // Сбрасываем флаг reset
    if (feed.reset) {
      postStore.clearResetFlag(feedType, feedType === "user" ? stableUserId : undefined);
    }
    
    // Устанавливаем флаг загрузки
    isLoadingRef.current = true;
    
    // Загружаем
    logger.log(`[PostsThread] Loading posts for ${feedType}${stableUserId ? ` ${stableUserId}` : ''}`);
    const userId = feedType === "user" ? stableUserId : undefined;
    
    postStore.fetchPosts(feedType, 1, userId)
      .catch(setSocketError)
      .finally(() => {
        isLoadingRef.current = false;
      });
    
  }, [feedType, stableUserId, feed.loading, feed.reset, feed.list.length, postStore]);

  // Восстановление скролла
  useEffect(() => {
    if (hasRestoredScrollRef.current) return;
    
    if (feedType === "feed") {
      const savedScrollPosition = navigationStore.feedScrollPosition;
      const hasSavedPosts = postStore.feedSavedPosts.length > 0;
      
      if (savedScrollPosition > 0 && hasSavedPosts) {
        logger.log(`[PostsThread] Restoring main feed from saved state, position: ${savedScrollPosition}`);
        postStore.onBackToFeed((position) => {
          window.scrollTo({ top: position, behavior: 'auto' });
          hasRestoredScrollRef.current = true;
        });
        return;
      }
      
      if (savedScrollPosition > 0 && feed.list.length > 0) {
        logger.log(`[PostsThread] Tab switch detected, restoring scroll position`);
        setTimeout(() => {
          window.scrollTo({ top: savedScrollPosition, behavior: 'auto' });
          hasRestoredScrollRef.current = true;
        }, 100);
        return;
      }
      
      if (savedScrollPosition > 0 && !hasSavedPosts && feed.list.length === 0) {
        logger.log(`[PostsThread] Direct URL detected, will load fresh feed`);
        navigationStore.feedScrollPosition = 0;
      }
    } 
    else if (feedType === "following" && navigationStore.followingScrollPosition > 0) {
      logger.log(`[PostsThread] Restoring following feed position: ${navigationStore.followingScrollPosition}`);
      setTimeout(() => {
        window.scrollTo({ top: navigationStore.followingScrollPosition, behavior: 'auto' });
        hasRestoredScrollRef.current = true;
      }, 100);
    }
  }, [feedType, feed.list.length, navigationStore, postStore]);

  // Сохранение позиции скролла при размонтировании
  useEffect(() => {
    const handleBeforeUnload = () => {
      navigationStore.saveTabScrollPosition(feedType === 'feed' ? 'all' : 'my');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      const currentScrollPosition = window.scrollY;
      if (currentScrollPosition > 0) {
        navigationStore.saveTabScrollPosition(
          feedType === 'feed' ? 'all' : 'my', 
          currentScrollPosition
        );
      }
    };
  }, [feedType, navigationStore]);
  
  const { estimateItemHeight, getItemKey } = usePostsFeed();
  const { virtualItems, totalHeight, measureElement } = useVirtualItems(
    feed.list, 
    getItemKey, 
    estimateItemHeight
  );

  // Обработчики событий
  const handleScrollDown = useCallback(() => {
    logger.log('[PostsThread] Enabling manual update mode');
    postStore.setManualUpdateMode(feedType, true);
  }, [feedType, postStore]);

  const handleLoadMore = useCallback(() => {
    if (feed.loading || feed.allLoaded) return;
    
    logger.log(`[PostsThread] Loading more ${feedType} posts`);
    
    if (feedType === "user") {
      postStore.loadMore(feedType, actualUserId);
    } else {
      postStore.loadMore(feedType);
    }
  }, [feedType, feed.loading, feed.allLoaded, actualUserId, postStore]);

  const handleLoadNewPosts = useCallback(() => {
    if (feed.buffer.length === 0) return;
    
    logger.log(`[PostsThread] Loading ${feed.buffer.length} new posts from buffer`);
    postStore.handleLoadNewPosts(feedType);
    postStore.setManualUpdateMode(feedType, false);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [feed.buffer.length, feedType, postStore]);

  const handleItemClick = useCallback((postSlug: string) => {
  logger.log(`[PostsThread] Navigate to post: ${postSlug}`);
  
  // Сохраняем позицию скролла в хранилище
  const currentScrollPosition = window.scrollY;
  
  // Преобразуем тип feed в main для соответствия ожидаемому типу в контексте
  const contextFeedType = feedType === "feed" ? "main" : feedType;
  
  navigationStore.pushNavigationPoint(
    window.location.pathname + window.location.search,
    { feedType: contextFeedType, userId: actualUserId },
    currentScrollPosition
  );
  
  // Используем хелпер для навигации
  navigationHelper.navigateToPost(postSlug);
}, [feedType, actualUserId, navigationStore, navigationHelper]);

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

  return (
    <div>
      {headerComponent}
      <VirtualList
        feedContextId={`${feedType}-${actualUserId || 'default'}`}
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
        enableManualModeTracking={feedType !== "user"}
        initialLoadComplete={feed.list.length > 0}
        endReachedThreshold={1500}
        debugOptions={{
          feedType,
          actualUserId,
          pageNumber: feed.page,
          totalPosts: feed.total,
          bufferSize: feed.buffer.length,
          manualMode: feed.manualUpdateMode,
          newPostsCount: feed.newPostsCount,
          feedListLength: feed.list.length,
          resetFlag: feed.reset,
          isLoadingLocal: isLoadingRef.current,
        }}
      />
    </div>
  );
});

export default PostsThread;