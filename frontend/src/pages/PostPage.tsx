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
  const { slug } = useParams<{ slug: string }>(); // Используем slug вместо postId
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsSort, setCommentsSort] = useState<'date' | 'likes'>('date');
  const [post, setPost] = useState<Post | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Navigation state handling
useEffect(() => {
  logger.log(`[PostPage] Mount with slug=${slug}`);
  
  // Сохраняем состояние из location или создаем дефолтное
  const stateToSave = location.state || 
    navigationStore.getStateForDirectUrl(location.pathname) || 
    { scrollPosition: 0, fromFeed: true, timestamp: Date.now() };
  
  navigationStore.saveStateFromLocation(stateToSave);
  
  // Проверяем, является ли это переходом обратно с комментария
  const isBackFromComment = navigationStore.currentState && 
                            navigationStore.currentState.fromComment === true;
  
  // Очищаем состояние только если это настоящий прямой доступ (не навигация назад)
  if (!location.state && !isBackFromComment) {
    logger.log('[PostPage] Direct URL access detected, clearing saved feed state');
    postStore.feedSavedPosts.clear();
    postStore.feedScrollPosition = 0;
  } else if (isBackFromComment) {
    logger.log('[PostPage] Back navigation from comment detected, preserving state');
  }
  
  return () => {
    logger.log(`[PostPage] Unmounting, saving scroll position: ${window.scrollY}`);
    navigationStore.currentState.scrollPosition = window.scrollY;
  };
}, [location.pathname, location.state, slug]);
// Load post and comments
useEffect(() => {
  if (!slug) return;

  let isMounted = true;

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      logger.log(`[PostPage] Loading post by slug: ${slug}`);

      // 1. Сначала ищем по slug в сторе
      let fetchedPost: Post | null = postStore.getPostBySlug(slug);

      if (!fetchedPost) {
        // 2. Если нет в сторе — загружаем с бэкенда по slug
        logger.log(`[PostPage] Post not found in store, fetching by slug: ${slug}`);
        fetchedPost = await postStore.fetchPostBySlug(slug);
      }

      // 3. Если все еще нет — пробуем fallback на ID
      if (!fetchedPost) {
        logger.log(`[PostPage] Post not found by slug, trying by ID as fallback: ${slug}`);
        fetchedPost = await postStore.fetchPostById(slug);
      }

      if (!isMounted) return;

      if (!fetchedPost) {
        setError("Post not found");
        setLoading(false);
        return;
      }

      setPost(fetchedPost);
      setLoading(false);

      // Проверяем наличие комментариев в хранилище
      const comments = commentStore.getComments(fetchedPost.id);
      logger.log(`[PostPage] Checking existing comments for ${fetchedPost.id}: found ${comments.length}`);
      
      // Проверяем тип доступа - с навигации или прямой
      const isDirectNavigation = 
        location.state && 
        (location.state.fromFeed === true || 
         location.state.fromComment === true || 
         location.state.fromUserProfile === true);
      
      logger.log(`[PostPage] Access type: ${isDirectNavigation ? 'navigation' : 'direct URL'}`);
      
      // Загружаем комментарии если их нет или это прямой доступ
      if (!isDirectNavigation || comments.length === 0) {
        logger.log(`[PostPage] Loading comments for post ${fetchedPost.id}`);
        setCommentsLoading(true);
        await commentStore.loadComments(fetchedPost.id, 25, 1, commentsSort);
        if (isMounted) {
          setCommentsLoading(false);
        }
      } else {
        logger.log(`[PostPage] Comments already loaded for post ${fetchedPost.id}, skipping load`);
      }
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
}, [slug, commentsSort, location.state]);
  
  // Handle back button
  const handleBackClick = useCallback(() => {
    if (!slug) return;
    
    logger.log(`[PostPage] Back navigation from post ${slug}`);
    
    const currentState = navigationStore.currentState;
    
    if (currentState && (currentState.fromFeed || currentState.fromFollowing || currentState.fromUserProfile)) {
      // Сохраняем текущую позицию скролла поста
      navigationStore.currentState.scrollPosition = window.scrollY;
      
      navigationStore.handleBackNavigation(navigate);
    } else {
      navigate(-1);
    }
  }, [slug, navigate]);

  // Handle comment added
  const handleCommentSuccess = useCallback(() => {
    if (!post) return;
    
    logger.log(`[PostPage] Comment added to post ${post.slug}`);
    setPost(prev => prev ? {...prev, commentCount: (prev.commentCount || 0) + 1} : null);
    message.success("Comment added");
    
    // Refresh comments
    commentStore.loadComments(post.id, 25, 1, commentsSort);
  }, [post, commentsSort]);
  
  // Handle sort change
  const handleSortChange = useCallback((sort: 'date' | 'likes') => {
    if (sort === commentsSort || !post) return;
    
    logger.log(`[PostPage] Changing comments sort to: ${sort}`);
    setCommentsSort(sort);
    setCommentsLoading(true);
    
    commentStore.loadComments(post.id, 25, 1, sort)
      .finally(() => {
        setCommentsLoading(false);
      });
  }, [post, commentsSort]);
  
  // Handle load more comments
  const handleLoadMoreComments = useCallback(() => {
    if (!post || commentsLoading) return;
    
    const comments = commentStore.getComments(post.id);
    const page = Math.floor(comments.length / 25) + 1;
    
    logger.log(`[PostPage] Loading more comments, page: ${page}`);
    setCommentsLoading(true);
    
    commentStore.loadComments(post.id, 25, page, commentsSort)
      .finally(() => {
        setCommentsLoading(false);
      });
  }, [post, commentsSort, commentsLoading]);

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
                postId={post.id} // Используем ID для создания комментария
                placeholder="Add a comment..."
                onSuccess={handleCommentSuccess}
              />
            </div>
          )}

          <div className="comments-section">
            <CommentsThread 
              postId={post.id} // Используем ID для загрузки комментариев
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