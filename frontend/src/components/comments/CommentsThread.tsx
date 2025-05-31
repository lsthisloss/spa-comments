import { useCallback, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { Empty, Spin, Button, Dropdown, Badge } from 'antd';
import { FilterOutlined } from '@ant-design/icons';
import { commentStore } from '../../services/stores/CommentStore';
import { useCommentsFeed } from '../../hooks/useFeedItems';
import { useVirtualItems } from '../../hooks/useVirtualItems';
import VirtualList from '../common/VirtualList';
import CommentItem from './CommentsItem';
import { Comment } from '../../types/interfaces';
import { logger } from '../../utils/Logger';

interface CommentsThreadProps {
  postId?: string;
  parentId?: string;
  loading?: boolean;
  onSortChange?: (sort: 'date' | 'likes') => void;
  onLoadMore?: () => void;
}

const CommentsThread = observer(({ 
  postId, 
  parentId,
  loading = false,
  onSortChange,
  onLoadMore
}: CommentsThreadProps) => {
  const targetId = postId || parentId;
  const isPost = !!postId;
  
  if (!targetId) {
    return <Empty description="No post or comment ID specified" />;
  }

  // Получаем комментарии или ответы в зависимости от типа
  const comments = isPost 
    ? commentStore.getComments(targetId)
    : commentStore.getReplies(targetId);
    
  const totalComments = isPost 
    ? commentStore.getTotalComments(targetId)
    : comments.length;

  const { estimateItemHeight, getItemKey } = useCommentsFeed();
  const {
    virtualItems,
    totalHeight,
    measureElement,
    handleImageLoad,
  } = useVirtualItems(comments, getItemKey, estimateItemHeight);

  const handleSortChange = useCallback((key: string) => {
    if (onSortChange && (key === 'date' || key === 'likes')) {
      logger.log(`CommentsThread: Requesting sort change to ${key}`);
      onSortChange(key as 'date' | 'likes');
    }
  }, [onSortChange]);
    
  useEffect(() => {
    if (!targetId) return;
    
    // Если это страница с комментарием (есть parentId), всегда показываем ответы
    if (parentId && !postId) {
      // Принудительно показываем ответы
      commentStore.setRepliesShown(parentId, true);
      
      // Загружаем ответы при необходимости
      const replies = commentStore.getReplies(parentId);
      if (!replies || replies.length === 0) {
        logger.log(`CommentsThread: Загружаем ответы для комментария ${parentId}`);
        if (onLoadMore) {
          onLoadMore();
        } else {
          commentStore.loadComments(parentId, 10, 1);
        }
      }
    }
  }, [targetId, parentId, postId, onLoadMore]);


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
          disableNestedComments={isPost ? false : true}
        />
      </div>
    );
  }, [handleImageLoad, getItemKey, isPost]);

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
    <div style={{ 
      padding: '16px',
      borderBottom: '1px solid #f0f0f0',
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center'
      }}>
        <div style={{ 
          fontSize: '14px',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>{isPost ? 'Comments' : 'Replies'}</span>
          <Badge 
            count={totalComments} 
            size="small" 
            style={{ marginLeft: '4px' }}
          />
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
            style={{ 
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              color: '#666',
              fontSize: '12px'
            }}
          >
            Sort
          </Button>
        </Dropdown>
      </div>
    </div>
  );

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