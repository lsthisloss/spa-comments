import { memo, useCallback, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { Post } from '../../../types/interfaces';
import PostItem from '../../posts/PostItem';
import { useNavigationHelper } from '../../../hooks/useNavigationHelper';
import { logger } from '../../../utils/Logger';

interface MemoizedPostItemProps {
  post: Post;
  onClick?: (slug: string) => void;
  onHeightChange?: () => void;
}

// Сначала делаем компонент наблюдаемым через observer
const PostItemWithComments = observer(({ post, onClick, onHeightChange }: MemoizedPostItemProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { navigateToEntity } = useNavigationHelper();
  
  const handleShowMore = useCallback(() => {
    if (onHeightChange) {
      setTimeout(() => onHeightChange(), 50);
    }
  }, [onHeightChange]);

  const handleClick = useCallback(() => {
    if (onClick) {
      onClick(post.slug);
    } else {
      navigateToEntity('post', post.slug);
    }
  }, [post.slug, onClick, navigateToEntity]);

  return (
    <div 
      ref={containerRef}
      id={`post-${post.id}`}
      className="post-container"
      style={{ 
        boxSizing: 'border-box',
        width: '100%',
        position: 'relative',
        display: 'block',
      }}
    >
      <PostItem        
        post={post}
        onClick={handleClick}
        onShowMore={handleShowMore}
      />
    </div>
  );
});

// Затем мемоизируем с правильной логикой сравнения
export const MemoizedPostItem = memo(PostItemWithComments, (prevProps, nextProps) => {
  // Проверяем все важные поля включая commentCount
  const shouldSkipUpdate = 
    prevProps.post.id === nextProps.post.id &&
    prevProps.post.content === nextProps.post.content &&
    prevProps.post.likes === nextProps.post.likes &&
    prevProps.post.imageUrl === nextProps.post.imageUrl &&
    prevProps.post.createdAt === nextProps.post.createdAt &&
    prevProps.post.commentCount === nextProps.post.commentCount &&
    prevProps.post.likedUserIds?.length === nextProps.post.likedUserIds?.length;
    
  // Логируем изменения для отладки
  if (prevProps.post.commentCount !== nextProps.post.commentCount) {
    logger.log(`[MemoizedPostItem] Re-rendering post ${prevProps.post.id} due to comment count change: ${prevProps.post.commentCount} → ${nextProps.post.commentCount}`);
  }
  
  if (prevProps.post.likes !== nextProps.post.likes) {
    logger.log(`[MemoizedPostItem] Re-rendering post ${prevProps.post.id} due to likes change: ${prevProps.post.likes} → ${nextProps.post.likes}`);
  }
  
  return shouldSkipUpdate;
});

export default MemoizedPostItem;