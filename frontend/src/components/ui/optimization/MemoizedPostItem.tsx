import  { memo, useCallback, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { Post } from '../../../types/interfaces';
import PostItem from '../../posts/PostItem';

interface MemoizedPostItemProps {
  post: Post;
  onClick?: (id: string) => void;
  onHeightChange?: () => void;
}

const PostItemWithComments = observer(({ post, onClick, onHeightChange }: MemoizedPostItemProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const handleShowMore = useCallback(() => {
    if (onHeightChange) {
      setTimeout(() => {
        onHeightChange();
      }, 50);
    }
  }, [onHeightChange]);

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
        onClick={() => onClick && onClick(post.id)} 
        onShowMore={handleShowMore}
      />
    </div>
  );
});
export const MemoizedPostItem = memo(PostItemWithComments, (prevProps, nextProps) => {
  // Сравниваем только базовые свойства поста
  return (
    prevProps.post.id === nextProps.post.id &&
    prevProps.post.content === nextProps.post.content &&
    prevProps.post.likes === nextProps.post.likes &&
    prevProps.post.imageUrl === nextProps.post.imageUrl &&
    prevProps.post.createdAt === nextProps.post.createdAt &&
    prevProps.post.commentCount === nextProps.post.commentCount
  );
});

export default MemoizedPostItem;