import { observer } from "mobx-react-lite";
import { useRef, useCallback, memo } from "react";
import FeedItem from '../common/FeedItem';
import { Post } from '../../types/interfaces';
import userStore from '../../services/stores/UserStore';
import { postStore } from '../../services/stores/PostStore';
import { navigationStore } from '../../services/stores/NavigationStore';
import { useNavigate } from 'react-router-dom';
import { logger } from "../../utils/Logger";

interface PostItemProps {
  post: Post;
  onClick?: () => void;
  onShowMore?: () => void;
  hideCommentButton?: boolean;
}

const PostItem = memo(observer(function PostItem({
  post,
  onClick,
  onShowMore,
  hideCommentButton,
}: PostItemProps) {
  
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  
  const handleLikeClick = useCallback(() => {
    if (userStore.user?.id && postStore) {
      postStore.toggleLike(post.id, userStore.user.id);
    }
  }, [post.id]);

  // Создаем специальный обработчик для навигации через кнопку
  const handleNavigate = useCallback((id: string) => {
    logger.log(`PostItem: handling navigation for post ${id}`);
    
    // Если есть внешний обработчик, вызываем его
    if (onClick) {
      logger.log(`PostItem: calling provided onClick`);
      onClick();
      return;
    }
    
    // Сохраняем состояние навигации и переходим на страницу поста
    logger.log(`PostItem: direct navigation to post ${id}`);
    const navigationState = navigationStore.saveNavigationState("post", id);
    navigate(`/post/${id}`, { state: navigationState });
  }, [onClick, navigate]);

  return (
    <div ref={containerRef} className="post-item">
      <FeedItem
        item={post}
        type="post"
        onNavigate={handleNavigate}
        onLikeClick={handleLikeClick}
        onShowMore={onShowMore}
        hideCommentButton={hideCommentButton}
      />
    </div>
  );
}), (prevProps, nextProps) => {
  return prevProps.post.id === nextProps.post.id;
});

export default PostItem;