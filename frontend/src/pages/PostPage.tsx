import { useEffect, useState, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { postStore } from '../services/stores/PostStore';
import { commentStore } from '../services/stores/CommentStore';
import { Empty, Button, Spin, message } from 'antd';
import PostItem from '../components/posts/PostItem';
import CommentsThread from '../components/comments/CommentsThread';
import SendForm from '../components/common/SendForm';
import userStore from '../services/stores/UserStore';
import { Post } from '../types/interfaces';
import { LeftOutlined, HomeOutlined } from '@ant-design/icons';
import { logger } from "../utils/Logger";
import { navigationStore } from '../services/stores/NavigationStore';

const PostPage = observer(() => {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsSort, setCommentsSort] = useState<'date' | 'likes'>('date');
  const [post, setPost] = useState<Post | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Navigation state handling
  useEffect(() => {
    logger.log(`[PostPage] Mount with postId=${postId}`);
    
    // Сохраняем состояние из location или создаем дефолтное
    const stateToSave = location.state || 
      navigationStore.getStateForDirectUrl(location.pathname) || 
      { scrollPosition: 0, fromFeed: true, timestamp: Date.now() };
    
    navigationStore.saveStateFromLocation(stateToSave);
    
    // Если это прямой переход (нет location.state), очищаем сохраненные посты
    if (!location.state) {
      logger.log('[PostPage] Direct URL access detected, clearing saved feed state');
      postStore.feedSavedPosts.clear();
      postStore.feedScrollPosition = 0;
    }
    
    return () => {
      logger.log(`[PostPage] Unmounting, saving scroll position: ${window.scrollY}`);
      navigationStore.currentState.scrollPosition = window.scrollY;
    };
  }, [location.pathname, location.state, postId]);

  // Load post and comments - simplified with clear sequence
useEffect(() => {
  if (!postId) return;
  
  let isMounted = true;
  
  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      logger.log(`[PostPage] Loading post: ${postId}`);
      // 1. Сначала ищем по slug
      let fetchedPost = postStore.getPostBySlug(postId);
      if (!fetchedPost) {
        // 2. Если нет в сторе — пробуем загрузить с backend (slug или id)
        fetchedPost = await postStore.fetchPostById(postId) ?? undefined;
      }

      if (!isMounted) return;

      if (!fetchedPost) {
        setError("Post not found");
        setLoading(false);
        return;
      }

      setPost(fetchedPost);
      setLoading(false);

      setCommentsLoading(true);
      logger.log(`[PostPage] Loading comments for post: ${postId}`);
      await commentStore.loadComments(fetchedPost.id, 25, 1, commentsSort);

      if (!isMounted) return;
    } catch (error) {
      if (!isMounted) return;
      logger.error(`[PostPage] Error loading data:`, error);
      setError("Error loading data");
    } finally {
      if (isMounted) {
        setLoading(false);
        setCommentsLoading(false);
      }
    }
  };

  loadData();

  return () => {
    isMounted = false;
  };
}, [postId, commentsSort]);
  
  // Handle back button
  const handleBackClick = useCallback(() => {
    if (!postId) return;
    
    logger.log(`[PostPage] Back navigation from post ${postId}`);
    
    const currentState = navigationStore.currentState;
    
    if (currentState && (currentState.fromFeed || currentState.fromFollowing || currentState.fromUserProfile)) {
      // Сохраняем текущую позицию скролла поста
      navigationStore.currentState.scrollPosition = window.scrollY;
      
      navigationStore.handleBackNavigation(navigate);
    } else {
      navigate(-1);
    }
  }, [postId, navigate]);

  // Handle comment added
  const handleCommentSuccess = useCallback(() => {
    if (!postId || !post) return;
    
    logger.log(`[PostPage] Comment added to post ${postId}`);
    setPost(prev => prev ? {...prev, commentCount: (prev.commentCount || 0) + 1} : null);
    message.success("Comment added");
    
    // Refresh comments
    commentStore.loadComments(postId, 25, 1, commentsSort);
  }, [postId, post, commentsSort]);
  
  // Handle sort change
  const handleSortChange = useCallback((sort: 'date' | 'likes') => {
    if (sort === commentsSort || !postId) return;
    
    logger.log(`[PostPage] Changing comments sort to: ${sort}`);
    setCommentsSort(sort);
    setCommentsLoading(true);
    
    commentStore.loadComments(postId, 25, 1, sort)
      .finally(() => {
        setCommentsLoading(false);
      });
  }, [postId, commentsSort]);
  
  // Handle load more comments
  const handleLoadMoreComments = useCallback(() => {
    if (!postId || commentsLoading) return;
    
    const comments = commentStore.getComments(postId);
    const page = Math.floor(comments.length / 25) + 1;
    
    logger.log(`[PostPage] Loading more comments, page: ${page}`);
    setCommentsLoading(true);
    
    commentStore.loadComments(postId, 25, page, commentsSort)
      .finally(() => {
        setCommentsLoading(false);
      });
  }, [postId, commentsSort, commentsLoading]);

  // Render
  return (
    <section className="post-page-container">
      <div className="post-header">
        <Button
          type="text"
          icon={<LeftOutlined />}
          onClick={handleBackClick}
          style={{ marginRight: 8 }}
        />
        <span className="post-span">Post</span>
        
        <Button
          type="text"
          icon={<HomeOutlined />}
          onClick={() => navigate('/')}
          style={{ marginLeft: 'auto' }}
        />
      </div>

      {loading ? (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <Spin size="large" />
          <p>Loading post...</p>
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Empty description={error} />
          <Button 
            type="primary" 
            onClick={() => window.location.reload()}
            style={{ marginTop: '16px' }}
          >
            Retry
          </Button>
        </div>
      ) : post ? (
        <>
          <div className="post-container">
            <PostItem 
              post={post} 
              hideCommentButton={true}
            />
          </div>

          {userStore.user && (
            <div className="comment-form-container">
              <SendForm 
                type="comment" 
                postId={postId}
                placeholder="Add a comment..."
                onSuccess={handleCommentSuccess}
              />
            </div>
          )}

          <div className="comments-section">
            <CommentsThread 
              postId={postId}
              loading={commentsLoading}
              onSortChange={handleSortChange}
              onLoadMore={handleLoadMoreComments}
            />
          </div>
        </>
      ) : (
        <Empty description="Post not found" />
      )}
    </section>
  );
});

export default PostPage;