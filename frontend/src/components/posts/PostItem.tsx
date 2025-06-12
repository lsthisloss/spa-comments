import { observer } from "mobx-react-lite";
import { useRef, useCallback, memo } from "react";
import FeedItem from '../common/FeedItem';
import { Post } from '../../types/interfaces';
import { logger } from "../../utils/Logger";
import { usePostStore, useUserStore } from '../../hooks/useStore';

/*
  Компонент для отображения отдельного поста в ленте.
  Используется в ленте постов и профиле пользователя.
  При клике на пост вызывает onClick с его slug.
*/
interface PostItemProps {
  post: Post;
  onClick?: (postSlug: string) => void;
  onShowMore?: () => void;
  hideCommentButton?: boolean;
}

const PostItem = memo(observer(function PostItem({
  post,
  onClick,
  onShowMore,
  hideCommentButton,
}: PostItemProps) {
  const postStore = usePostStore();
  const userStore = useUserStore();
  
  const containerRef = useRef<HTMLDivElement>(null);
  
  const handleLikeClick = useCallback(() => {
    if (userStore.user?.id && postStore) {
      postStore.toggleLike(post.id, userStore.user.id);
    }
  }, [post.id, userStore.user, postStore]);

  // Обработчик клика по посту по слагу
  const handleClick = useCallback(() => {
    logger.log(`PostItem: handling click for post ${post.slug}`);
    
    if (onClick) {
      logger.log(`PostItem: calling provided onClick`);
      onClick(post.slug);
    }
  }, [onClick, post.slug]);

  return (
    <div ref={containerRef} className="post-item">
      <FeedItem
        item={post}
        type="post"
        onLikeClick={handleLikeClick}
        onShowMore={onShowMore}
        hideCommentButton={hideCommentButton}
        onClick={handleClick}
      />
    </div>
  );
}), (prevProps, nextProps) => {
  return (
    prevProps.post.id === nextProps.post.id &&
    prevProps.post.commentCount === nextProps.post.commentCount &&
    prevProps.post.likes === nextProps.post.likes &&
    prevProps.post.content === nextProps.post.content
  );
});

export default PostItem;