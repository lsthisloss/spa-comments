import { observer } from "mobx-react-lite";
import { useRef, useCallback, memo } from "react";
import FeedItem from '../common/FeedItem';
import { Post } from '../../types/interfaces';
import { useNavigate } from 'react-router-dom';
import { logger } from "../../utils/Logger";
import { usePostStore, useUserStore, useNavigationStore } from '../../hooks/useStore';

interface PostItemProps {
  post: Post;
  onClick?: (slug: string) => void;
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
  const navigationStore = useNavigationStore();
  
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  
  const handleLikeClick = useCallback(() => {
    if (userStore.user?.id && postStore) {
      postStore.toggleLike(post.id, userStore.user.id);
    }
  }, [post.id, userStore.user, postStore]);

  const handleClick = useCallback(() => {
    logger.log(`PostItem: handling click for post ${post.slug}`);
    
    if (onClick) {
      logger.log(`PostItem: calling provided onClick`);
      onClick(post.slug);
      return;
    }
    
    logger.log(`PostItem: direct navigation to post ${post.slug}`);
    const currentScrollPosition = window.scrollY;
    navigationStore.pushNavigationPoint(
      window.location.pathname + window.location.search,
      { pageType: 'feed', feedType: 'main' },
      currentScrollPosition
    );
    navigate(`/post/${post.slug}`);
  }, [onClick, navigate, post.slug, navigationStore]);

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
  // сравниваем все ключевые поля включая commentCount
  return (
    prevProps.post.id === nextProps.post.id &&
    prevProps.post.commentCount === nextProps.post.commentCount &&
    prevProps.post.likes === nextProps.post.likes &&
    prevProps.post.content === nextProps.post.content
  );
});

export default PostItem;