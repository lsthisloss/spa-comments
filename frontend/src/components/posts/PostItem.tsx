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

  const handleNavigate = useCallback((slug: string) => {
    logger.log(`PostItem: handling navigation for post ${slug}`);
    
    if (onClick) {
      logger.log(`PostItem: calling provided onClick`);
      onClick(post.slug);
      return;
    }
    
    logger.log(`PostItem: direct navigation to post ${slug}`);
    const navigationState = navigationStore.saveNavigationState("post", post.slug);
    navigate(`/post/${slug}`, { state: navigationState });
  }, [onClick, navigate, post.slug, navigationStore]);

  return (
    <div ref={containerRef} className="post-item">
      <FeedItem
        item={post}
        type="post"
        onNavigate={handleNavigate}
        onLikeClick={handleLikeClick}
        onShowMore={onShowMore}
        hideCommentButton={hideCommentButton}
        onClick={undefined}
      />
    </div>
  );
}), (prevProps, nextProps) => {
  return prevProps.post.id === nextProps.post.id;
});

export default PostItem;