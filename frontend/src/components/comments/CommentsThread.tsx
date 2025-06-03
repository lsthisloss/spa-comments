import { useCallback, useEffect, useMemo } from 'react';
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
      const comment = commentStore.getCommentBySlug(parentSlug);
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
  const comments = isPost 
    ? commentStore.getComments(targetId)
    : commentStore.getReplies(targetId);
    
  const totalComments = isPost 
    ? commentStore.getTotalComments(targetId)
    : comments.length;

  // Setup virtualization
  const { estimateItemHeight, getItemKey } = useCommentsFeed();
  const {
    virtualItems,
    totalHeight,
    measureElement,
    handleImageLoad,
  } = useVirtualItems(comments, getItemKey, estimateItemHeight);

  // Sort handler
  const handleSortChange = useCallback((key: string) => {
    if (onSortChange && (key === 'date' || key === 'likes')) {
      logger.log(`CommentsThread: Requesting sort change to ${key}`);
      onSortChange(key as 'date' | 'likes');
    }
  }, [onSortChange]);
    
  // Load comments/replies if needed
  useEffect(() => {
    if (autoLoad !== false && !targetId) return;
    
    // Special handling for viewing a single comment's replies
    if (resolveEntityIds.effectiveParentId && !resolveEntityIds.effectivePostId) {
      // Always show replies for parent comment
      commentStore.setRepliesShown(resolveEntityIds.effectiveParentId, true);
      
      // Load replies if none exist
      const replies = commentStore.getReplies(resolveEntityIds.effectiveParentId);
      if (!replies || replies.length === 0) {
        if (onLoadMore) {
          onLoadMore();
        } else {
          commentStore.loadComments(resolveEntityIds.effectiveParentId, 10, 1, undefined, true);
        }
      }
    }
  }, [autoLoad, targetId, resolveEntityIds.effectiveParentId, resolveEntityIds.effectivePostId, onLoadMore, commentStore]);

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
      ) : comments.length >= totalComments ? (
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
            selectedKeys: [commentStore.sort]
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
        items={comments}
        renderItem={renderComment}
        getItemKey={getItemKey}
        totalHeight={totalHeight}
        virtualItems={virtualItems}
        measureElement={measureElement}
        onEndReached={onLoadMore}
        loading={loading}
        loadingIndicator={loadingIndicator}
        allLoaded={comments.length >= totalComments}
        loadingMessage="Loading comments..."
        emptyMessage="No comments available"
      />
    </div>
  );
});

export default CommentsThread;