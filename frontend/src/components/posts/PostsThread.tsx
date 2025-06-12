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


  // Feed state - получаем один раз и кешируем, чтобы избежать лишних пересчетов
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

  useEffect(() => {
    // Если переключились на "my" таб и данных нет - принудительно загружаем
    if (activeTab === "my") {
      const followingFeed = postStore.feeds.following;
      if (followingFeed.list.length === 0 && !followingFeed.loading) {
        logger.log(`[useTabs] Switched to 'my' tab with empty following feed, forcing load`);
        postStore.fetchFollowingPosts(1);
      }
    }
  }, [activeTab, postStore]);

  useEffect(() => {
    // Инициализация localPosts и отслеживание изменений
    let initialPosts: Post[];
    if (activeTab === "user" && actualUserId) {
      initialPosts = postStore.currentUserFeedList;
    } else if (activeTab === "all") {
      initialPosts = postStore.currentFeedList;
    } else {
      initialPosts = postStore.currentFollowingList;
    }

    setLocalPosts(initialPosts);

    // Если данных нет для ТЕКУЩЕГО feedType - загружаем
    const currentFeedState = activeTab === "user" && actualUserId
      ? postStore.feeds.user
      : activeTab === "all"
        ? postStore.feeds.feed
        : postStore.feeds.following;

    // Проверяем данные именно для текущего feed, а не общие localPosts
    if (currentFeedState.list.length === 0 && !isLoadingRef.current && !currentFeedState.loading) {
      logger.log(`[PostsThread] No data for current ${feedType} feed, loading...`);

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
        logger.log(`[PostsThread] ${feedType} load completed after tab switch`);
      });
    }

    // Отслеживаем изменения в store через reaction
    const disposer = reaction(
      () => {
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
      disposer();
    };
  }, [activeTab, actualUserId, postStore, feedType, stableUserId, feedState.loading]);
  // Force top scroll
  useEffect(() => {
    if (forceTopScroll && localPosts.length > 0) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [forceTopScroll, localPosts.length]);

  /*
    Эффект для переключения на пользовательскую ленту.
    Если выбран тип ленты "user" и есть stableUserId, переключаемся на эту ленту.
    Это позволяет динамически менять контекст пользователя в зависимости от выбранной вкладки.
  */
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

  /*
    Обработчик загрузки новых постов из буфера.
    Вызывается при клике на уведомление о новых постах.
    Прокручивает страницу вверх и инициирует загрузку новых постов из буфера.
  */
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
    const handleLoadBufferedPosts = (event: CustomEvent) => {
      const { feedType: eventFeedType } = event.detail;

      if (eventFeedType === 'posts' || eventFeedType === feedType) {
        logger.log(`[PostsThread] Loading buffered posts for ${feedType}`);
        postStore.loadBufferedPosts(feedType);
      }
    };

    window.addEventListener('loadBufferedPosts', handleLoadBufferedPosts as EventListener);

    return () => {
      window.removeEventListener('loadBufferedPosts', handleLoadBufferedPosts as EventListener);
    };
  }, [feedType, postStore]);

  /*
    Эффект для логирования состояния компонента после рендера.
    Используется для отладки и мониторинга состояния ленты постов.
    Логирует количество постов, состояние загрузки и другие параметры.
  */
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