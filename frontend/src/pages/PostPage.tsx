import { useEffect, useState, useCallback, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { usePostStore, useCommentStore, useUserStore } from '../hooks/useStore';
import { Empty, Button, Spin } from 'antd';
import PostItem from '../components/posts/PostItem';
import CommentsThread from '../components/comments/CommentsThread';
import SendForm from '../components/common/SendForm';
import { Post } from '../types/interfaces';
import { LeftOutlined, HomeOutlined } from '@ant-design/icons';
import { logger } from "../utils/Logger";
import { useNavigationHelper } from "../hooks/useNavigationHelper";

const PostPage = observer(() => {
  // Используем хуки для получения сторов
  const postStore = usePostStore();
  const commentStore = useCommentStore();
  const userStore = useUserStore();
  const navigationHelper = useNavigationHelper();

  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Refs for tracking state
  const mountedRef = useRef(false);
  const commentsLoadedRef = useRef(false);
  const navigationRef = useRef(false);
  const postFetchedRef = useRef<string | null>(null);
  
  // Component state
  const [loading, setLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsSort, setCommentsSort] = useState<'date' | 'likes'>('date');
  const [post, setPost] = useState<Post | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Инициализация компонента - становка mountedRef
  useEffect(() => {
    mountedRef.current = true; // Устанавливаем в true при монтировании
    logger.log(`[PostPage] Component mounted for slug: ${slug}`);
    
    return () => {
      logger.log(`[PostPage] Component unmounting for slug: ${slug}`);
      mountedRef.current = false;
    };
  }, [slug]);
  
  // Load comments for the current post
  const loadComments = useCallback((postSlug: string, reset = false) => {
    if (!mountedRef.current) {
      logger.log(`[PostPage] Skipping loadComments - component not mounted`);
      return Promise.resolve();
    }
    
    if (reset) {
      commentsLoadedRef.current = false;
    }
    
    if (!commentsLoadedRef.current) {
      setCommentsLoading(true);
      
      logger.log(`[PostPage] Loading comments for post: ${postSlug}`);
      return commentStore.loadCommentsBySlug(postSlug, 10, 1, commentsSort, false)
        .then(() => {
          if (mountedRef.current) {
            commentsLoadedRef.current = true;
            setCommentsLoading(false);
            logger.log(`[PostPage] Comments loaded for post: ${postSlug}`);
          } else {
            logger.log(`[PostPage] Component unmounted, skipping comments update`);
          }
        })
        .catch(err => {
          if (mountedRef.current) {
            logger.error(`[PostPage] Error loading comments: ${err.message}`);
            setCommentsLoading(false);
          }
        });
    }
    
    return Promise.resolve();
  }, [commentsSort, commentStore]);
  
  // Load post and comments - исправляем логику
  useEffect(() => {
    if (!slug || !mountedRef.current) {
      logger.log(`[PostPage] No slug provided or component not mounted`);
      return;
    }
    
    // Предотвращаем повторную загрузку того же поста
    if (postFetchedRef.current === slug) {
      logger.log(`[PostPage] Post ${slug} already fetched, skipping`);
      return;
    }   
    // Reset state for new slug
    setLoading(true);
    setError(null);
    commentsLoadedRef.current = false;
    postFetchedRef.current = null;
    navigationRef.current = location.state !== null;
    
    logger.log(`[PostPage] Loading post with slug: ${slug}, from navigation: ${navigationRef.current}`);
    
    // Fetch post by slug
    postStore.fetchPostBySlug(slug)
      .then(fetchedPost => {
        logger.log(`[PostPage] Post fetch complete for ${slug}, post found: ${!!fetchedPost}`);
        
        if (!mountedRef.current) {
          logger.log(`[PostPage] Component unmounted during fetch, aborting updates`);
          return;
        }
        
        if (fetchedPost) {
          logger.log(`[PostPage] Setting post state and proceeding to load comments`);
          setPost(fetchedPost);
          setLoading(false);
          postFetchedRef.current = slug;
          
          // Загружаем комментарии после установки поста
          setTimeout(() => {
            if (mountedRef.current) {
              loadComments(slug);
            }
          }, 100);
          
          // Update comment count in post store to keep UI consistent
          if (fetchedPost.commentCount !== undefined) {
            postStore.updatePostCommentCountBySlug(slug, fetchedPost.commentCount);
          }
        } else {
          setError('Post not found');
          setLoading(false);
          logger.error(`[PostPage] Post not found with slug: ${slug}`);
        }
      })
      .catch(err => {
        logger.error(`[PostPage] Error in promise chain: ${err}`);
        
        if (mountedRef.current) {
          logger.error(`[PostPage] Error loading post: ${err.message}`);
          setError(`Failed to load post: ${err.message}`);
          setLoading(false);
        }
      });
  }, [slug, location.state, loadComments, postStore]);

  // Handle comment sort change
  const handleSortChange = useCallback((sort: 'date' | 'likes') => {
    if (!mountedRef.current) return;
    
    setCommentsSort(sort);
    
    if (post && post.slug) {
      setCommentsLoading(true);
      commentStore.loadCommentsBySlug(post.slug, 10, 1, sort, false)
        .then(() => {
          if (mountedRef.current) {
            setCommentsLoading(false);
          }
        })
        .catch(() => {
          if (mountedRef.current) {
            setCommentsLoading(false);
          }
        });
    }
  }, [post, commentStore]);

  // Load more comments
  const handleLoadMoreComments = useCallback(() => {
    if (!post?.id || commentsLoading || !mountedRef.current) return;
    
    setCommentsLoading(true);
    commentStore.loadMoreComments(post.id, 10)
      .then(() => {
        if (mountedRef.current) {
          setCommentsLoading(false);
        }
      })
      .catch(() => {
        if (mountedRef.current) {
          setCommentsLoading(false);
        }
      });
  }, [post, commentsLoading, commentStore]);

  // Handle successful comment creation
  const handleCommentSuccess = useCallback(() => {
    if (!post?.slug || !mountedRef.current) return;
    
    // Force reload comments after adding a new one
    commentsLoadedRef.current = false;
    loadComments(post.slug, true);
    
    // Update post comment count in all feeds
    const newCount = (post.commentCount || 0) + 1;
    postStore.updatePostCommentCountBySlug(post.slug, newCount);
  }, [post, loadComments, postStore]);

  // Handle back navigation
  const handleGoBack = useCallback(() => {
  navigationHelper.goBack();
}, [navigationHelper]);
  // Retry loading post
  const handleRetry = useCallback(() => {
    if (!slug || !mountedRef.current) return;
    
    setLoading(true);
    setError(null);
    commentsLoadedRef.current = false;
    postFetchedRef.current = null;
    
    logger.log(`[PostPage] Retrying to load post with slug: ${slug}`);
    
    // Re-fetch без очистки кэша (пусть fetchPostBySlug сам решает)
    postStore.fetchPostBySlug(slug)
      .then(fetchedPost => {
        if (!mountedRef.current) return;
        
        if (fetchedPost) {
          setPost(fetchedPost);
          setLoading(false);
          postFetchedRef.current = slug;
          loadComments(slug, true);
        } else {
          setError('Post not found');
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mountedRef.current) {
          logger.error(`[PostPage] Error loading post: ${err.message}`);
          setError(`Failed to load post: ${err.message}`);
          setLoading(false);
        }
      });
  }, [slug, loadComments, postStore]);

  // Не рендерим пока компонент не смонтирован
  if (!mountedRef.current) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <Spin size="large" />
        <p>Initializing...</p>
      </div>
    );
  }

  return (
    <section className="post-page-container">
      <div className="post-header">
        <Button
          type="text"
          icon={<LeftOutlined />}
          onClick={handleGoBack}
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