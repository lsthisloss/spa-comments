import { useCallback, useEffect, useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Empty, Spin, Button, Dropdown, Badge } from 'antd';
import { FilterOutlined } from '@ant-design/icons';
import { useCommentsFeed } from '../../hooks/useFeedItems';
import { useVirtualItems } from '../../hooks/useVirtualItems';
import VirtualList from '../common/VirtualList';
import CommentItem from './CommentsItem';
import { Comment } from '../../types/interfaces';
import { logger } from '../../utils/Logger';
import { useCommentStore, usePostStore } from '../../hooks/useStore';

interface CommentsThreadProps {
  postId?: string;
  postSlug?: string;
  parentId?: string;
  parentSlug?: string;
  loading?: boolean;
  onLoadMore?: () => void;
  onSortChange?: (sort: 'date' | 'likes') => void;
  autoLoad?: boolean;
  enableNestedReplies?: boolean;
}

const CommentsThread = observer(({
  postId,
  postSlug,
  parentId,
  parentSlug,
  loading = false,
  onSortChange,
  onLoadMore,
  autoLoad = true,
  enableNestedReplies = false,
}: CommentsThreadProps) => {
  const commentStore = useCommentStore();
  const postStore = usePostStore();
  // Helper to resolve entity IDs from slugs
  const resolveEntityIds = useMemo(() => {
    // First try direct IDs
    let effectivePostId = postId;
    let effectiveParentId = parentId;

    // Then try to resolve from slugs
    if (!effectivePostId && postSlug) {
      const post = postStore.getPostBySlug(postSlug);
      effectivePostId = post?.id;
    }

    if (!effectiveParentId && parentSlug) {
      const comment = commentStore.getCommentBySlug(parentSlug, false);
      effectiveParentId = comment?.id;
    }

    // Determine if we're showing post comments or comment replies
    const targetId = effectivePostId || effectiveParentId;
    const isPost = !!effectivePostId;

    return { targetId, isPost, effectivePostId, effectiveParentId };
  }, [postId, postSlug, parentId, parentSlug, postStore, commentStore]);

  const { targetId, isPost } = resolveEntityIds;

  // Handle missing target
  if (!targetId) {
    return <Empty description="No post or comment ID specified" />;
  }

  // Get comments or replies based on entity type
  const allComments = isPost ? commentStore.getComments(targetId) : commentStore.getReplies(targetId);
  
  const totalComments = isPost ? commentStore.getTotalComments(targetId) : commentStore.getTotalReplies(targetId);
const [sortingInProgress] = useState(false);


const [localSort, setLocalSort] = useState<'date' | 'likes'>('date');
const sortedComments = useMemo(() => {
  if (!allComments || allComments.length === 0) return [];
  
  // Создаем копию массива для сортировки
  return [...allComments].sort((a, b) => {
    if (localSort === 'likes') {
      // Сортировка по лайкам (по убыванию)
      return (b.likes || 0) - (a.likes || 0);
    } else {
      // Сортировка по дате (по убыванию - новые сверху)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });
}, [allComments, localSort]);


const handleSortChange = useCallback((key: string) => {
  // СНАЧАЛА проверяем, нужно ли сортировать
  if ((key === 'date' || key === 'likes') && key !== localSort) {
    logger.log(`CommentsThread: Setting local sort to ${key}`);
    
    // Обновляем локальную сортировку
    setLocalSort(key as 'date' | 'likes');
    
    // Вызываем callback для синхронизации с родителем если нужно
    if (onSortChange) {
      onSortChange(key as 'date' | 'likes');
    }
  } else if (key === localSort) {
    logger.log(`[CommentsThread] Sort ${key} already active, ignoring click`);
  }
}, [localSort, onSortChange]);

  // Setup virtualization
  const { estimateItemHeight, getItemKey } = useCommentsFeed();
  const {
    virtualItems,
    totalHeight,
    measureElement,
    handleImageLoad,
  } = useVirtualItems(sortedComments, getItemKey, estimateItemHeight);



  useEffect(() => {
    if (autoLoad === false || !targetId) return;

    logger.log(`[CommentsThread] Auto-load check for targetId: ${targetId}, isPost: ${isPost}`);

    if (isPost) {
      const existingComments = commentStore.getComments(targetId);
      const hasComments = existingComments && existingComments.length > 0;

      if (!hasComments) {
        logger.log(`[CommentsThread] Auto-loading comments for post: ${targetId}`);

        if (onLoadMore) {
          onLoadMore();
        } else {
          // Используем postSlug если есть, иначе пытаемся найти пост по ID
          if (postSlug) {
            commentStore.loadCommentsBySlug(postSlug, 10, 1, 'date', false)
              .then(() => {
                logger.log(`[CommentsThread] Comments loaded for post slug: ${postSlug}`);
              })
              .catch((error) => {
                logger.error(`[CommentsThread] Failed to load comments for post slug ${postSlug}:`, error);
              });
          } else {
            logger.warn(`[CommentsThread] No postSlug provided for auto-loading comments`);
          }
        }
      } else {
        logger.log(`[CommentsThread] Post ${targetId} already has ${existingComments.length} comments, skipping auto-load`);
      }
    } else {
      // Для комментариев (не постов)
      logger.log(`[CommentsThread] Loading replies for comment: ${targetId}`);

      const existingReplies = commentStore.getReplies(targetId);
      logger.log(`[CommentsThread] Current replies count: ${existingReplies.length}`);

      if (existingReplies.length === 0) {
        logger.log(`[CommentsThread] Auto-loading replies for comment: ${targetId}`);

        if (onLoadMore) {
          onLoadMore();
        } else {
          commentStore.loadComments(targetId, 1, 10, 'date');
        }
      } else {
        logger.log(`[CommentsThread] Comment ${targetId} already has ${existingReplies.length} replies, skipping auto-load`);
      }
    }
  }, [
    autoLoad,
    targetId,
    isPost,
    postSlug,
    onLoadMore,
    commentStore
  ]);
  // Comment rendering
  const renderComment = useCallback((virtualItem: { item: Comment; index: number }, measureRef: (el: HTMLElement | null) => void) => {
    const comment = virtualItem.item as Comment;

    return (
      <div
        ref={measureRef}
        data-virtual-index={virtualItem.index}
        style={{ marginBottom: '8px' }}
        onLoad={() => handleImageLoad(getItemKey(comment), virtualItem.index)}
      >
        <CommentItem
          item={comment}
          disableNestedComments={enableNestedReplies ? false : !isPost}
        />
      </div>
    );
  }, [handleImageLoad, getItemKey, isPost, enableNestedReplies]);

  // UI Components
  const loadingIndicator = (
  <div style={{ textAlign: 'center', padding: '20px' }}>
    {loading ? (
      <>
        <Spin size="small" />
        <p style={{ margin: '8px 0 0 0', color: '#666' }}>
          Loading {isPost ? 'comments' : 'replies'}...
        </p>
      </>
    ) : sortedComments.length >= totalComments ? (
      <p style={{ color: '#999', margin: 0 }}>
        {isPost ? 'All comments loaded' : 'All replies loaded'}
      </p>
    ) : null}
  </div>
);

  const headerComponent = (
    <div style={{ padding: '16px', borderBottom: '1px solid #f0f0f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '14px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>{isPost ? 'Comments' : 'Replies'}</span>
          <Badge count={totalComments} size="small" style={{ marginLeft: '4px' }} />
        </div>

        <Dropdown
          menu={{
            items: [
              { key: 'date', label: <span>🕒 By date</span> },
              { key: 'likes', label: <span>❤️ By likes</span> }
            ],
            onClick: ({ key }) => handleSortChange(key),
            selectedKeys: [localSort],
          }}
          trigger={['click']}
          placement="bottomRight"
        >
          <Button
            type="text"
            icon={<FilterOutlined />}
            size="small"
            style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#666', fontSize: '12px' }}
          >
           Sort
          </Button>
        </Dropdown>
      </div>
    </div>
  );

  // Main render
  return (
    <div className="comments-thread">
      {headerComponent}
      <VirtualList
        items={sortedComments}
        renderItem={renderComment}
        getItemKey={getItemKey}
        totalHeight={totalHeight}
        virtualItems={virtualItems}
        measureElement={measureElement}
        onEndReached={onLoadMore}
        loading={loading}
        loadingIndicator={loadingIndicator}
        allLoaded={sortedComments ? sortedComments.length >= totalComments : false}
        loadingMessage="Loading comments..."
        emptyMessage="No comments available"
          debugOptions={{ 
          sortingInProgress,
          targetId,
          isPost 
        }}
      />
    </div>
  );
});

export default CommentsThread;