import FeedItem from '../common/FeedItem';
import { Comment } from '../../types/interfaces';
import userStore from '../../services/stores/UserStore';
import { commentStore } from '../../services/stores/CommentStore';
import { logger } from "../../utils/Logger";
import { useNavigate } from 'react-router-dom';
import { useCallback } from 'react';
import { navigationStore } from '../../services/stores/NavigationStore';
import { observer } from 'mobx-react-lite';

const CommentItemContent = observer(function CommentItemInner(props: { 
  item: Comment; 
  disableShowMore?: boolean; 
  onNavigate?: (id: string) => void;
  onShowMore?: () => void;
  hideCommentButton?: boolean;
}) {
  const { item, disableShowMore, onNavigate, onShowMore } = props;
  const navigate = useNavigate();

  const handleLikeClick = useCallback(() => {
    if (userStore.user?.id) {
      logger.log(`Comment ${item.id} like clicked by user ${userStore.user.id}`);
      commentStore.toggleLike(item.id, userStore.user.id);
    } else {
      logger.warn("User is not logged in");
    }
  }, [item.id]);
  
const handleNavigate = useCallback((id: string) => {
  logger.log(`CommentItem: handling navigation for comment ${id}`);
  
  try {
    // Если есть внешний обработчик, используем его
    if (onNavigate) {
      logger.log(`CommentItem: calling provided onNavigate`);
      onNavigate(id);
      return;
    }
    
    // Сохраняем состояние и переходим на страницу комментария
    logger.log(`CommentItem: direct navigation to comment ${id}`);
    const slug = item.slug || id;

    const navigationState = navigationStore.saveNavigationState("comment", slug);
    navigate(`/comment/${slug}`, { state: navigationState });
  } catch (error) {
    logger.error(`Navigation error for comment ${id}:`, error);

    const slug = item.slug || id;
    navigate(`/comment/${slug}`);
  }
}, [onNavigate, navigate, item.slug]);

  return (
    <FeedItem
      item={item}
      type="comment"
      disableShowMore={disableShowMore}
      onNavigate={handleNavigate}
      onLikeClick={handleLikeClick}
      onShowMore={onShowMore}
      hideCommentButton={props.hideCommentButton}
    />
  );
});

function CommentItem(props: { 
  item: Comment; 
  disableShowMore?: boolean; 
  onNavigate?: (id: string) => void;
  disableNestedComments?: boolean;
  onShowMore?: () => void;
  hideCommentButton?: boolean;
}) {
  return <CommentItemContent {...props} />;
}

const ObservedCommentItem = observer(CommentItem);
export default ObservedCommentItem;