import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Empty, Button, Spin, message } from 'antd';
import { LeftOutlined, HomeOutlined } from '@ant-design/icons';
import { commentStore } from '../services/stores/CommentStore';
import { Comment } from '../types/interfaces';
import CommentItem from '../components/comments/CommentsItem';
import CommentsThread from '../components/comments/CommentsThread';
import SendForm from '../components/common/SendForm';
import { logger } from "../utils/Logger";
import { navigationStore } from '../services/stores/NavigationStore';
import userStore from '../services/stores/UserStore';
import { socketStore } from '../services/stores/SocketStore';

const CommentPage = observer(() => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  
  // Получаем slug комментария из URL
  const commentSlug = useMemo(() => {
    // Из параметров URL
    const slug = params.commentId;
    
    // Из пути URL, если параметры пусты
    if (!slug && location.pathname.includes('/comment/')) {
      const pathParts = location.pathname.split('/');
      const lastPart = pathParts[pathParts.length - 1];
      if (lastPart && lastPart !== 'comment') {
        return lastPart;
      }
    }
    
    // Из состояния навигации
    if (!slug && location.state?.slug) {
      return location.state.slug;
    }
    
    return slug;
  }, [params.commentId, location.pathname, location.state]);
  
  // Состояние компонента
  const mountedRef = useRef(true);
  const loadingRef = useRef(false);
  const repliesLoadedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState<Comment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [repliesSort, setRepliesSort] = useState<'date' | 'likes'>('date');
  
  // Управление жизненным циклом компонента
  useEffect(() => {
    mountedRef.current = true;
    
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Проверка наличия slug и перенаправление если нет
  useEffect(() => {
    if (!commentSlug) {
      if (location.pathname.includes('/comment/')) {
        navigate('/', { replace: true });
      }
      setError('Comment slug is missing');
      setLoading(false);
      return;
    }
    
    // Обновляем URL если slug есть, но его нет в пути
    if (commentSlug && !location.pathname.includes(commentSlug)) {
      navigate(`/comment/${commentSlug}`, { 
        replace: true,
        state: location.state 
      });
    }
  }, [commentSlug, navigate, location.pathname, location.state]);

  // Сохранение состояния навигации
  useEffect(() => {
    if (!commentSlug) return;
    
    const stateToSave = location.state || 
      navigationStore.getStateForDirectUrl(location.pathname) || 
      { scrollPosition: 0, fromFeed: true, timestamp: Date.now() };
    
    navigationStore.saveStateFromLocation(stateToSave);
    
    return () => {
      if (mountedRef.current) {
        navigationStore.currentState.scrollPosition = window.scrollY;
      }
    };
  }, [location.pathname, location.state, commentSlug]);

  // Загрузка комментария
  useEffect(() => {
    if (!commentSlug || loadingRef.current) return;
    
    const loadComment = async () => {
      loadingRef.current = true;
      
      try {
        if (!mountedRef.current) return;
        setLoading(true);
        setError(null);

        // Сначала ищем в кэше
        let fetchedComment = commentStore.getCommentBySlug(commentSlug);

        // Если нет в кэше - загружаем с сервера
        if (!fetchedComment) {
          // Проверяем соединение сокета
          if (!socketStore.comments?.connected) {
            await new Promise<void>((resolve, reject) => {
              let attempts = 0;
              const interval = setInterval(() => {
                attempts++;
                if (!mountedRef.current) {
                  clearInterval(interval);
                  reject(new Error('Component unmounted'));
                  return;
                }
                
                if (socketStore.comments?.connected) {
                  clearInterval(interval);
                  resolve();
                } else if (attempts >= 20) {
                  clearInterval(interval);
                  reject(new Error('Socket connection timeout'));
                }
              }, 100);
            });
          }
          
          if (!mountedRef.current) return;
          
          // Загружаем комментарий с сервера
          fetchedComment = await commentStore.fetchCommentBySlug(commentSlug);
        }

        if (!mountedRef.current) return;

        if (!fetchedComment) {
          setError("Comment not found");
          setLoading(false);
          return;
        }

        setComment(fetchedComment);
        setLoading(false);
      } catch (error) {
        if (!mountedRef.current) return;
        
        logger.error('[CommentPage] Error loading comment:', error);
        setError('Error loading comment');
        setLoading(false);
      } finally {
        loadingRef.current = false;
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    };

    loadComment();
  }, [commentSlug]);

  // Загрузка ответов на комментарий
  useEffect(() => {
    if (!comment?.slug || !comment.repliesCount || repliesLoadedRef.current) return;
    
    setRepliesLoading(true);
    
    commentStore.loadCommentsBySlug(comment.slug, 10, 1, repliesSort, true)
      .then(() => {
        if (mountedRef.current) {
          repliesLoadedRef.current = true;
        }
      })
      .finally(() => {
        if (mountedRef.current) {
          setRepliesLoading(false);
        }
      });
    
    return () => {
      repliesLoadedRef.current = false;
    };
  }, [comment?.slug, comment?.repliesCount, repliesSort]);

  // Обработчик загрузки дополнительных ответов
  const handleLoadMoreReplies = useCallback(() => {
    if (!comment?.slug || !mountedRef.current) return;
    
    const replies = commentStore.getRepliesBySlug(comment.slug);
    const page = Math.floor(replies.length / 10) + 1;
    
    setRepliesLoading(true);
    
    commentStore.loadCommentsBySlug(comment.slug, 10, page, repliesSort, true)
      .finally(() => {
        if (mountedRef.current) {
          setRepliesLoading(false);
        }
      });
  }, [comment?.slug, repliesSort]);

  // Обработчик изменения сортировки
  const handleSortChange = useCallback((sort: 'date' | 'likes') => {
    if (sort === repliesSort || !comment?.slug || !mountedRef.current) return;
    
    setRepliesSort(sort);
    setRepliesLoading(true);
    repliesLoadedRef.current = false;
    
    commentStore.loadCommentsBySlug(comment.slug, 10, 1, sort, true)
      .finally(() => {
        if (mountedRef.current) {
          setRepliesLoading(false);
          repliesLoadedRef.current = true;
        }
      });
  }, [comment?.slug, repliesSort]);

  // Обработчик повторной попытки
  const handleRetry = useCallback(() => {
    if (!commentSlug || !mountedRef.current) return;
    
    loadingRef.current = false;
    setLoading(true);
    setError(null);
  }, [commentSlug]);

  // Обработчик возврата назад
  const handleBackClick = useCallback(() => {
    if (!commentSlug) return;
    
    const currentState = navigationStore.currentState;
    
    // Если нет истории навигации, но есть связанный пост
    if (!location.state && comment?.postId) {
      const postState = {
        fromComment: true,
        slug: commentSlug,
        postId: comment.postSlug || comment.postId,
        scrollPosition: 0,
        timestamp: Date.now()
      };
      
      navigationStore.currentState = postState;
      navigate(`/post/${comment.postSlug || comment.postId}`, { 
        replace: true,
        state: postState
      });
      return;
    }
    
    // Если есть история навигации
    if (currentState && (currentState.fromFeed || currentState.fromFollowing || 
                         currentState.fromUserProfile || currentState.fromPost)) {
      // Если возвращаемся на пост
      if (currentState.fromPost && currentState.postId) {
        currentState.fromComment = true;
      }
      
      navigationStore.handleBackNavigation(navigate);
    } else {
      navigate(-1);
    }
  }, [commentSlug, navigate, location.state, comment]);

  // Обработчик успешного добавления ответа
  const handleReplySuccess = useCallback(() => {
    if (!mountedRef.current) return;
    
    message.success('Reply added successfully');
    
    // Прокрутка к секции ответов
    setTimeout(() => {
      if (!mountedRef.current) return;
      
      const repliesSection = document.querySelector('.comments-section');
      if (repliesSection) {
        repliesSection.scrollIntoView({ behavior: 'smooth' });
      }
    }, 300);
  }, []);

  return (
    <section className="post-page-container">
      <div className="post-header">
        <Button
          type="text"
          icon={<LeftOutlined />}
          onClick={handleBackClick}
          style={{ marginRight: 8 }}
        />
        <span className="post-span">Comment</span>
        
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
          <p>Loading comment...</p>
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
      ) : comment ? (
        <>
          <div className="comment-container">
            <CommentItem
              item={comment}
              hideCommentButton={true}
            />
          </div>

          {userStore.user && (
            <div className="comment-form-container">
              <SendForm 
                type="comment" 
                parentSlug={comment.slug}
                postSlug={comment.postSlug || comment.postId}
                placeholder="Post your reply..."
                onSuccess={handleReplySuccess}
              />
            </div>
          )}

          <div className="comments-section">
            <CommentsThread 
              key={`replies-${comment.slug}-${repliesSort}`}
              parentSlug={comment.slug}
              loading={repliesLoading}
              onLoadMore={handleLoadMoreReplies}
              onSortChange={handleSortChange}
            />
          </div>
        </>
      ) : (
        <Empty description="Comment not found" />
      )}
    </section>
  );
});

export default CommentPage;