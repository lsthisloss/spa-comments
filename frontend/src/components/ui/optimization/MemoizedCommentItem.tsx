import { memo, useCallback, useRef } from 'react';
import CommentItem from '../../comments/CommentsItem';
import { Comment } from '../../../types/interfaces';
import { useNavigate } from 'react-router-dom';
import { navigationStore } from '../../../services/stores/NavigationStore';
import { logger } from '../../../utils/Logger';

interface MemoizedCommentItemProps {
  comment: Comment;
  onClick: (id: string) => void;
  onHeightChange?: () => void;
}

export const MemoizedCommentItem = memo(({ comment, onClick, onHeightChange }: MemoizedCommentItemProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const handleShowMore = useCallback(() => {
    if (onHeightChange) {
      setTimeout(() => {
        onHeightChange();
      }, 50);
    }
  }, [onHeightChange]);
  
const handleNavigate = useCallback((id: string) => {
  try {
    if (onClick) {
      onClick(id);
    } else {
      const slug = comment.slug || id;
      const navigationState = navigationStore.saveNavigationState("comment", slug);
      navigate(`/comment/${slug}`, { state: navigationState });
    }
  } catch (error) {
    logger.error(`Navigation error in MemoizedCommentItem for ${id}:`, error);
    const slug = comment.slug || id;
    navigate(`/comment/${slug}`);
  }
}, [onClick, navigate, comment.slug]);


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