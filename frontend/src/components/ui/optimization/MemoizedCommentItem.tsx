import { memo, useCallback, useRef } from 'react';
import CommentItem from '../../comments/CommentsItem';
import { Comment } from '../../../types/interfaces';
import { useNavigationHelper } from '../../../hooks/useNavigationHelper';

interface MemoizedCommentItemProps {
  comment: Comment;
  onClick?: (id: string) => void;
  onHeightChange?: () => void;
}
/*
  Компонент для отображения отдельного комментария в ленте.
  Используется в ленте комментариев и на страницах постов.
  При клике на комментарий вызывает onClick с его ID.
  Позволяет обрабатывать изменение высоты комментария.
*/
export const MemoizedCommentItem = memo(({ comment, onClick, onHeightChange }: MemoizedCommentItemProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { navigateToEntity } = useNavigationHelper();

  const handleShowMore = useCallback(() => {
    if (onHeightChange) {
      setTimeout(() => onHeightChange(), 50);
    }
  }, [onHeightChange]);
  
const handleNavigate = useCallback((id: string) => {
    // Сначала проверяем, есть ли переданный onClick
    if (onClick) {
      onClick(id);
    } else {
      // Fallback: используем navigateToEntity
      navigateToEntity('comment', comment.slug || id);
    }
  }, [onClick, navigateToEntity, comment.slug]);


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

export default MemoizedCommentItem;