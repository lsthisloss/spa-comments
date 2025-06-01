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
  
  // Refs for tracking state
  const lastActiveTabRef = useRef(activeTab);
  const hasRestoredScrollRef = useRef(false);
  const initialLoadRef = useRef(false);
  const lastUserIdRef = useRef(userId);
  const lastLoadAttemptRef = useRef<number>(0);
  
  // Determine feed type and get data
  const { feedType, feed } = useMemo(() => {
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

  // Unified scroll restoration
  useEffect(() => {
    // Handle scroll restoration
    const handleScrollRestore = () => {
      if (hasRestoredScrollRef.current) return;
      
      if (feedType === "feed") {
        const savedScrollPosition = navigationStore.feedScrollPosition;
        const hasSavedPosts = postStore.feedSavedPosts.length > 0;
        
        // Case 1: We have saved position and posts
        if (savedScrollPosition > 0 && hasSavedPosts) {
          logger.log(`[PostsThread] Restoring main feed from saved state, position: ${savedScrollPosition}`);
          postStore.onBackToFeed((position) => {
            window.scrollTo({ top: position, behavior: 'auto' });
            hasRestoredScrollRef.current = true;
            initialLoadRef.current = true;
          });
          return true;
        }
        
        // Case 2: Tab switch with existing posts
        if (savedScrollPosition > 0 && feed.list.length > 0) {
          logger.log(`[PostsThread] Tab switch detected, restoring scroll position`);
          setTimeout(() => {
            window.scrollTo({ top: savedScrollPosition, behavior: 'auto' });
            hasRestoredScrollRef.current = true;
          }, 100);
          return true;
        }
        
        // Case 3: Direct URL - reset scroll position
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
        return true;
      }
      
      return false;
    };
    
    // Try to restore scroll, return if successful
    if (handleScrollRestore()) return;
    
  }, [feedType, feed.list.length]);

  // Save scroll position on unmount
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
  }, [feedType]);
  
  // Virtualization
  const { virtualItems, totalHeight, measureElement } = useVirtualItems(
    feed.list, 
    getItemKey, 
    estimateItemHeight
  );

  // Unified feed loading logic
  useEffect(() => {
    // Feed type/user change detection
    const feedChanged = feedType !== lastActiveTabRef.current || userId !== lastUserIdRef.current;
    
    if (feedChanged) {
      logger.log(`[PostsThread] Feed changed from ${lastActiveTabRef.current} to ${feedType}, userId: ${lastUserIdRef.current} -> ${userId}`);
      lastActiveTabRef.current = feedType;
      lastUserIdRef.current = userId;
      hasRestoredScrollRef.current = false;
      
      // Load fresh data if needed
      if (feed.list.length === 0 && !feed.loading && !feed.allLoaded) {
        logger.log(`[PostsThread] Starting initial load for changed feed`);
        
        if (feed.reset) {
          postStore.clearResetFlag(feedType, userId);
        }
        
        postStore.fetchPosts(feedType, 1, userId).catch(setSocketError);
        initialLoadRef.current = true;
        return;
      }
    }

    // Initial load for empty feed
    if (feed.list.length === 0 && !feed.loading && !feed.reset && !feed.allLoaded && !initialLoadRef.current) {
      // Throttle requests
      const now = Date.now();
      if (now - (lastLoadAttemptRef.current || 0) < 3000) {
        logger.log(`[PostsThread] Skipping load - throttled`);
        return;
      }
      
      logger.log(`[PostsThread] Initial load for ${feedType}`);
      lastLoadAttemptRef.current = now;
      postStore.fetchPosts(feedType, 1, userId).catch(setSocketError);
      initialLoadRef.current = true;
    }
    
    // Handle reset flag
    if (feed.reset && !feed.loading) {
      logger.log(`[PostsThread] Processing reset flag for ${feedType}`);
      postStore.clearResetFlag(feedType, userId);
      postStore.fetchPosts(feedType, 1, userId).catch(setSocketError);
    }
  }, [feedType, userId, feed.list.length, feed.loading, feed.reset, feed.allLoaded]);

  // Event handlers
  const handleScrollDown = useCallback(() => {
    logger.log('[PostsThread] Enabling manual update mode');
    postStore.setManualUpdateMode(feedType, true);
  }, [feedType]);

  const handleLoadMore = useCallback(() => {
    if (feed.loading || feed.allLoaded) return;
    
    logger.log(`[PostsThread] Loading more ${feedType} posts`);
    postStore.loadMore(feedType, userId);
  }, [feedType, feed.loading, feed.allLoaded, userId]);

  const handleLoadNewPosts = useCallback(() => {
    if (feed.buffer.length === 0) return;
    
    logger.log(`[PostsThread] Loading ${feed.buffer.length} new posts from buffer`);
    postStore.handleLoadNewPosts(feedType);
    postStore.setManualUpdateMode(feedType, false);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [feed.buffer.length, feedType]);

  // Navigation with slug
  const handleItemClick = useCallback((postSlug: string) => {
    logger.log(`[PostsThread] Navigate to post: ${postSlug}`);
    
    // Save current scroll position
    const currentScrollPosition = window.scrollY;
    if (feedType === "feed") {
      postStore.saveFeedState(currentScrollPosition);
    }
    
    // Navigation with proper state
    const navigationState = navigationStore.saveNavigationState('post', postSlug);
    navigate(`/post/${postSlug}`, { state: navigationState });
  }, [navigate, feedType]);

  // Item rendering
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

  // UI components
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
        enableManualModeTracking={feedType !== "user"}
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