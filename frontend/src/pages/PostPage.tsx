import { useEffect, useState, useCallback, useRef } from 'react';
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
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Refs для отслеживания состояния
  const mountedRef = useRef(true);
  const loadingRef = useRef(false);
  const commentsLoadedRef = useRef(false);
  
  // Состояние компонента
  const [loading, setLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsSort, setCommentsSort] = useState<'date' | 'likes'>('date');
  const [post, setPost] = useState<Post | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Управление жизненным циклом компонента
  useEffect(() => {
    mountedRef.current = true;
    
    return () => {
      logger.log(`[PostPage] Unmounting, saving scroll position: ${window.scrollY}`);
      navigationStore.currentState.scrollPosition = window.scrollY;
      mountedRef.current = false;
    };
  }, []);

  // Сохранение состояния навигации
  useEffect(() => {
    if (!slug) return;
    
    logger.log(`[PostPage] Mount with slug=${slug}`);
    
    // Сохраняем состояние из location или создаем дефолтное
    const stateToSave = location.state || 
      navigationStore.getStateForDirectUrl(location.pathname) || 
      { scrollPosition: 0, fromFeed: true, timestamp: Date.now() };
    
    navigationStore.saveStateFromLocation(stateToSave);
    
    // Проверяем, является ли это переходом обратно с комментария
    const isBackFromComment = navigationStore.currentState && navigationStore.currentState.fromComment === true;
    
    // Очищаем состояние только если это настоящий прямой доступ (не навигация назад)
    if (!location.state && !isBackFromComment) {
      logger.log('[PostPage] Direct URL access detected, clearing saved feed state');
      postStore.feedSavedPosts.clear();
      postStore.feedScrollPosition = 0;
    } else if (isBackFromComment) {
      logger.log('[PostPage] Back navigation from comment detected, preserving state');
    }
  }, [location.pathname, location.state, slug]);
  
  // Загрузка поста
  useEffect(() => {
    if (!slug || loadingRef.current) return;
    
    const loadData = async () => {
      loadingRef.current = true;
      
      try {
        if (!mountedRef.current) return;
        setLoading(true);
        setError(null);

        logger.log(`[PostPage] Loading post by slug: ${slug}`);

        // 1. Сначала ищем по slug в сторе
        let fetchedPost: Post | null = postStore.getPostBySlug(slug);

        if (!fetchedPost) {
          // 2. Если нет в сторе — загружаем с бэкенда по slug
          logger.log(`[PostPage] Post not found in store, fetching by slug: ${slug}`);
          fetchedPost = await postStore.fetchPostBySlug(slug);
        }

        if (!mountedRef.current) return;

        if (!fetchedPost) {
          setError("Post not found");
          setLoading(false);
          return;
        }

        setPost(fetchedPost);
        setLoading(false);

        // Загрузка комментариев
        // Проверяем наличие комментариев в хранилище
        const comments = commentStore.getCommentsByPostSlug(slug);
        logger.log(`[PostPage] Checking existing comments for ${slug}: found ${comments.length}`);
        
        // Проверяем тип доступа - с навигации или прямой
        const isDirectNavigation = 
          location.state && 
          (location.state.fromFeed === true || 
           location.state.fromComment === true || 
           location.state.fromUserProfile === true);
        
        logger.log(`[PostPage] Access type: ${isDirectNavigation ? 'navigation' : 'direct URL'}`);
        
        // Загружаем комментарии если их нет или это прямой доступ
        if ((!isDirectNavigation || comments.length === 0) && !commentsLoadedRef.current) {
          logger.log(`[PostPage] Loading comments for post ${slug}`);
          setCommentsLoading(true);
          await commentStore.loadCommentsBySlug(slug, 25, 1, commentsSort, false);
          
          if (mountedRef.current) {
            commentsLoadedRef.current = true;
            setCommentsLoading(false);
          }
        } else {
          logger.log(`[PostPage] Comments already loaded for post ${slug}, skipping load`);
        }
      } catch (error) {
        if (!mountedRef.current) return;
        
        logger.error(`[PostPage] Error loading data:`, error);
        setError("Error loading data");
      } finally {
        loadingRef.current = false;
        
        if (mountedRef.current) {
          setLoading(false);
          setCommentsLoading(false);
        }
      }
    };

    loadData();
  }, [slug, location.state, commentsSort]);

  // Обработчик возврата назад
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

  // Обработчик успешного добавления комментария
  const handleCommentSuccess = useCallback(() => {
    if (!post || !mountedRef.current) return;
    
    logger.log(`[PostPage] Comment added to post ${post.slug}`);
    setPost(prev => prev ? {...prev, commentCount: (prev.commentCount || 0) + 1} : null);
    message.success("Comment added");
    
    // Обновление комментариев
    commentStore.loadCommentsBySlug(post.slug, 25, 1, commentsSort);
  }, [post, commentsSort]);
  
  // Обработчик изменения сортировки комментариев
  const handleSortChange = useCallback((sort: 'date' | 'likes') => {
    if (sort === commentsSort || !post || !mountedRef.current) return;
    
    logger.log(`[PostPage] Changing comments sort to: ${sort}`);
    setCommentsSort(sort);
    setCommentsLoading(true);
    commentsLoadedRef.current = false;
    
    commentStore.loadCommentsBySlug(post.slug, 25, 1, sort, false)
      .finally(() => {
        if (mountedRef.current) {
          setCommentsLoading(false);
          commentsLoadedRef.current = true;
        }
      });
  }, [post, commentsSort]);
  
  // Обработчик загрузки дополнительных комментариев
  const handleLoadMoreComments = useCallback(() => {
    if (!post || commentsLoading || !mountedRef.current) return;
    
    const comments = commentStore.getCommentsByPostSlug(post.slug);
    const page = Math.floor(comments.length / 25) + 1;
    
    logger.log(`[PostPage] Loading more comments, page: ${page}`);
    setCommentsLoading(true);
    
    commentStore.loadCommentsBySlug(post.slug, 25, page, commentsSort, true)
      .finally(() => {
        if (mountedRef.current) {
          setCommentsLoading(false);
        }
      });
  }, [post, commentsSort, commentsLoading]);

  // Обработчик повторной попытки загрузки
  const handleRetry = useCallback(() => {
    if (!slug || !mountedRef.current) return;
    
    loadingRef.current = false;
    commentsLoadedRef.current = false;
    setLoading(true);
    setError(null);
  }, [slug]);

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
            onClick={handleRetry}
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
                postSlug={post.slug}
                placeholder="Add a comment..."
                onSuccess={handleCommentSuccess}
              />
            </div>
          )}

          <div className="comments-section">
            <CommentsThread 
              key={`comments-${post.slug}-${commentsSort}`}
              postSlug={post.slug}
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