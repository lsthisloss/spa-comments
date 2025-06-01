import { memo, useCallback, useRef } from 'react';
import CommentItem from '../../comments/CommentsItem';
import { Comment } from '../../../types/interfaces';
import { useNavigationHelper } from '../../../hooks/useNavigationHelper';

interface MemoizedCommentItemProps {
  comment: Comment;
  onClick?: (id: string) => void;
  onHeightChange?: () => void;
}

export const MemoizedCommentItem = memo(({ comment, onClick, onHeightChange }: MemoizedCommentItemProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { navigateToEntity } = useNavigationHelper();

  const handleShowMore = useCallback(() => {
    if (onHeightChange) {
      setTimeout(() => onHeightChange(), 50);
    }
  }, [onHeightChange]);
  
  const handleNavigate = useCallback((id: string) => {
    navigateToEntity('comment', id, onClick);
  }, [onClick, navigateToEntity]);

  return (
    <div 
      ref={containerRef}
      id={`comment-${comment.id}`}
      className="comment-container"
      style={{ 
        boxSizing: 'border-box',
        width: '100%',
        position: 'relative',
        display: 'block',
      }}
    >
      <CommentItem        
        item={comment} 
        onNavigate={handleNavigate}
        disableShowMore={false}
        onShowMore={handleShowMore}
      />
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.comment.id === nextProps.comment.id &&
    prevProps.comment.imageUrl === nextProps.comment.imageUrl &&
    prevProps.comment.fileUrl === nextProps.comment.fileUrl
  );
});