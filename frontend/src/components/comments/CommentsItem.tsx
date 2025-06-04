import FeedItem from '../common/FeedItem';
import { Comment } from '../../types/interfaces';
import { logger } from "../../utils/Logger";
import { useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { useUserStore, useCommentStore } from '../../hooks/useStore';

interface CommentItemProps {
  item: Comment; 
  disableShowMore?: boolean; 
  onNavigate?: (id: string) => void;
  onShowMore?: () => void;
  disableNestedComments?: boolean;
  hideCommentButton?: boolean;
}

const CommentItem = observer((props: CommentItemProps) => {
  const { item, disableShowMore, onShowMore, hideCommentButton = false } = props;
  const userStore = useUserStore();
  const commentStore = useCommentStore();

  // Handle like click
  const handleLikeClick = useCallback(() => {
    if (!userStore.user?.id) {
      logger.warn("User is not logged in");
      return;
    }
    
    logger.log(`Comment ${item.id} like clicked by user ${userStore.user.id}`);
    commentStore.toggleLike(item.id, userStore.user.id);
  }, [item.id, userStore.user, commentStore]);

  return (
    <FeedItem
      item={item}
      type="comment"
      disableShowMore={disableShowMore}
      onLikeClick={handleLikeClick}
      onShowMore={onShowMore}
      hideCommentButton={hideCommentButton || props.disableNestedComments}
    />
  );
});

export default CommentItem;