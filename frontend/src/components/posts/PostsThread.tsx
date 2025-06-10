import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { usePostsFeed } from "../../hooks/useFeedItems";
import { NewPostNotification } from "../ui/particles/NewPostNotification";
import MemoizedPostItem from "../ui/optimization/MemoizedPostItem";
import VirtualList from '../common/VirtualList';
import { Post } from "../../types/interfaces";
import { logger } from "../../utils/Logger";
import { usePostStore, useUserStore } from "../../hooks/useStore";
import { FeedType } from "../../types/enums";
import { useNavigationHelper } from "../../hooks/useNavigationHelper";
import { reaction } from "mobx";

/*
  Компонент для отображения ленты постов.
  Поддерживает разные типы лент: пользовательская, общая, подписки.
  Реализует виртуальный скроллинг и загрузку новых постов.
  Используем MobX для управления состоянием постов и пользователя.
  Компонент автоматически обновляется при изменении данных в store.
*/
interface PostsFeedProps {
  activeTab: string;
  userId?: string;
  forceTopScroll?: boolean;
}

const PostsThread = observer(({ activeTab, userId: propsUserId, forceTopScroll }: PostsFeedProps) => {
  // MobX stores
  // Используем MobX для управления состоянием постов и пользователя
  const postStore = usePostStore();
  const userStore = useUserStore();
  const navigationHelper = useNavigationHelper();
  // Получаем MobX store для навигации
  const actualUserId = propsUserId || userStore.user?.id;
  // Если userId не передан, используем текущего пользователя из MobX store
  const stableUserId = useMemo(() => actualUserId, [actualUserId]);

  /*
    Референс для отслеживания состояния загрузки данных.
    Используем useRef, чтобы избежать лишних перерисовок компонента.
    Это позволяет нам сохранять состояние загрузки между рендерами без влияния на производительность.
  */
  const isLoadingRef = useRef(false);

  // Локальное состояние для React-рендеринга
  const [localPosts, setLocalPosts] = useState<Post[]>([]);

  // Feed type selection
  const feedType: FeedType = useMemo(() => {
    if (activeTab === "user") return "user";
    return activeTab === "all" ? "feed" : "following";
  }, [activeTab]);

  // Реактивная связь с MobX store
  useEffect(() => {
    // Начальное значение
    if (activeTab === "user" && actualUserId) {
      setLocalPosts(postStore.currentUserFeedList);
    } else if (activeTab === "all") {
      setLocalPosts(postStore.currentFeedList);
    } else {
      setLocalPosts(postStore.currentFollowingList);
    }

    // Отслеживаем изменения в store через reaction
    const disposer = reaction(
      () => {
        // Отслеживаем нужную коллекцию в зависимости от таба
        if (activeTab === "user" && actualUserId) {
          const directList = postStore.feeds.user.list.length;
          return {
            posts: postStore.currentUserFeedList,
            length: directList
          };
        } else if (activeTab === "all") {
          const directList = postStore.feeds.feed.list.length;
          return {
            posts: postStore.currentFeedList,
            length: directList
          };
        } else {
          const directList = postStore.feeds.following.list.length;
          return {
            posts: postStore.currentFollowingList,
            length: directList
          };
        }
      },
      (result) => {
        const posts = result.posts;
        logger.log(`[PostsThread] MobX reaction detected change in ${feedType} posts: ${posts.length} items`);
        setLocalPosts(posts);
      }
    );

    return () => {
      disposer(); // Очищаем reaction при размонтировании
    };
  }, [activeTab, actualUserId, postStore, feedType]);

  // Feed state - получаем один раз и кешируем
  const feedState = useMemo(() => {
    if (activeTab === "user" && actualUserId) {
      return postStore.feeds.user;
    }
    return activeTab === "all"
      ? postStore.feeds.feed
      : postStore.feeds.following;
  }, [activeTab, actualUserId, postStore]);

  // Feed key generation
  const feedKey = useMemo(() => {
    if (activeTab === "user" && stableUserId) {
      return `user-${stableUserId}`;
    }
    return activeTab === "all" ? 'feed-default' : 'following-default';
  }, [activeTab, stableUserId]);

  const { estimateItemHeight, getItemKey } = usePostsFeed();

  // Initial data loading
  useEffect(() => {
    const actualFeedLength = postStore.getFeed("feed").list.length;

    if ((actualFeedLength === 0 || postStore.needsFeedCheck) && !feedState.loading) {
      logger.log('[PostsThread] No data for feed, loading fresh');
      postStore.setNeedsFeedCheck(false);
      postStore.fetchPosts('feed', 1);
    }
  }, [postStore, feedState.loading]);

  // Force top scroll
  useEffect(() => {
    if (forceTopScroll && localPosts.length > 0) {
      logger.log(`[PostsThread] forceTopScroll requested, scrolling to top`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [forceTopScroll, localPosts.length]);

  // Data loading logic
useEffect(() => {
  if (isLoadingRef.current || feedState.loading) return;

  const hasData = localPosts.length > 0;
  const needsRefresh = feedState.reset;
  
  // Проверка на пустую базу данных
  const isEmpty = feedState.allLoaded && feedState.total === 0 && localPosts.length === 0;
  
  if (isEmpty) {
    logger.log(`[PostsThread] ${feedType} feed is empty (total: 0), skipping load`);
    return;
  }

  if (hasData && !needsRefresh) {
    logger.log(`[PostsThread] Using cached data for ${feedType} (${localPosts.length} posts)`);
    return;
  }

  if (!hasData) {
    logger.log(`[PostsThread] No data for ${feedType}, loading fresh`);
  } else if (needsRefresh) {
    logger.log(`[PostsThread] Force refresh requested for ${feedType}, loading fresh`);
    postStore.clearResetFlag(feedType, feedType === "user" ? stableUserId : undefined);
  }

  // Проверяем, не выполняется ли уже загрузка
  isLoadingRef.current = true;

    let fetchPromise: Promise<void>;

    if (feedType === "user" && stableUserId) {
      fetchPromise = postStore.fetchUserPosts(stableUserId, 1);
    } else if (feedType === "following") {
      fetchPromise = postStore.fetchFollowingPosts(1);
    } else {
      fetchPromise = postStore.fetchFeedPosts(1);
    }

    fetchPromise.finally(() => {
      isLoadingRef.current = false;
    });
  }, [feedType, stableUserId, feedState.loading, feedState.reset, localPosts.length, postStore, feedState.allLoaded, feedState.total]);

  // User feed switching
  useEffect(() => {
    if (feedType === "user" && stableUserId) {
      postStore.switchToUser(stableUserId);
    }
  }, [feedType, stableUserId, postStore]);

  // Обработчик загрузки новых постов
  const handleLoadMore = useCallback(() => {
    if (feedState.allLoaded && feedState.total === 0) {
      logger.log(`[PostsThread] Cannot load more: feed is empty (total: 0)`);
      return;
    }

    // Проверяем, не выполняется ли уже загрузка
    if (feedState.loading || (feedState.allLoaded && !feedState.allowLoadMore)) return;

    if (feedState.allowLoadMore) {
      feedState.allowLoadMore = false;
    }

    // Логируем событие загрузки
    if (feedType === "user") {
      postStore.loadMore(feedType, actualUserId);
    } else {
      postStore.loadMore(feedType);
    }
  }, [feedState, feedType, postStore, actualUserId]);

  // Обработчик загрузки новых постов из буфера
  // Вызывается при клике на уведомление о новых постах
  const handleLoadNewPosts = useCallback(() => {
    if (feedState.buffer.length === 0) return;

    logger.log(`[PostsThread] Loading ${feedState.buffer.length} new posts from buffer`);

    window.scrollTo({ top: 0, behavior: 'smooth' });

    setTimeout(() => {
      postStore.handleLoadNewPosts(feedType);
      postStore.setManualUpdateMode(feedType, false);
      window.scrollTo({ top: 0, behavior: 'auto' });
    }, 200);
  }, [feedState.buffer.length, feedType, postStore]);

  // Обработчик клика по посту
  const handleItemClick = useCallback((postSlug: string) => {
    logger.log(`[PostsThread] Navigate to post: ${postSlug}`);

    navigationHelper.navigateToPost(postSlug);
  }, [navigationHelper]);

  // Рендеринг постов
  const renderPostItem = useCallback((item: Post, index: number) => {
    const isNewPost = (Date.now() - new Date(item.createdAt).getTime()) < 30000;

    return (
      <div
        id={`post-${item.id}`}
        data-virtual-index={index}
        data-post-id={item.id}
      >
        <MemoizedPostItem
          post={item}
          onClick={handleItemClick}
          isNewItem={isNewPost}
        />
      </div>
    );
  }, [handleItemClick]);

  const shouldShowNotification = feedState.manualUpdateMode && feedState.newPostsCount > 0 && feedType !== "user";

  useEffect(() => {
    logger.log(`[PostsThread] Final debug state:`, {
      feedType,
      postsCount: localPosts.length,
      storeListLength: feedState.list.length,
      isLoading: feedState.loading,
      allLoaded: feedState.allLoaded,
      userId: actualUserId
    });
  }, [feedType, localPosts.length, feedState, actualUserId]);

  return (
    <div className="posts-thread">
      {shouldShowNotification && (
        <NewPostNotification
          latestPost={feedState.latestPost}
          onFocusPost={() => { }}
          newPostsCount={feedState.newPostsCount}
          onLoadNewPosts={handleLoadNewPosts}
          truncateContent={(text: string) => text.length > 50 ? `${text.substring(0, 50)}...` : text}
        />
      )}

      <VirtualList
        key={feedKey}
        feedContextId={feedKey}
        items={localPosts}
        renderItem={renderPostItem}
        getItemKey={getItemKey}
        estimateItemHeight={estimateItemHeight}
        onEndReached={handleLoadMore}
        loading={feedState.loading}
        allLoaded={feedState.allLoaded}
        className="posts-virtual-list"
        manualMode={feedState.manualUpdateMode}
        debugOptions={{
          feedType: 'posts',
          bufferSize: feedState.buffer.length,
          newPostsCount: feedState.newPostsCount,
          currentPage: Math.ceil(localPosts.length / 20),
          totalPosts: localPosts.length,
          userId: actualUserId,
          feedKey,
          storeListLength: feedState.list.length,
          contextType: 'posts',
          activeTab,
        }}
      />
    </div>
  );
});

export default PostsThread;