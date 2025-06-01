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
  
  // Используем useMemo для стабильного commentId
  const commentId = useMemo(() => {
    // Получаем из параметров URL
    const id = params.commentId;
    
    // Пробуем получить из location.pathname, если параметры пусты
    if (!id && location.pathname.includes('/comment/')) {
      const pathParts = location.pathname.split('/');
      const lastPart = pathParts[pathParts.length - 1];
      if (lastPart && lastPart !== 'comment') {
        logger.log(`[CommentPage] Extracted commentId from pathname: ${lastPart}`);
        return lastPart;
      }
    }
    
    // Пробуем получить из состояния навигации
    if (!id && location.state && location.state.commentId) {
      logger.log(`[CommentPage] Using commentId from navigation state: ${location.state.commentId}`);
      return location.state.commentId;
    }
    
    // Возвращаем ID из параметров или undefined
    logger.log(`[CommentPage] Using commentId from params: ${id}`);
    return id;
  }, [params.commentId, location.pathname, location.state]);
  
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState<Comment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [repliesSort, setRepliesSort] = useState<'date' | 'likes'>('date');
  
  // Заменяем useState на useRef для fetchAttempted
  const fetchAttemptedRef = useRef(false);
  
  // Debugging mount/unmount cycle
  useEffect(() => {
    logger.log(`[CommentPage] MOUNTED with commentId=${commentId}`);
    
    // Сбрасываем флаг загрузки при изменении commentId
    if (commentId) {
      logger.log(`[CommentPage] New commentId detected, resetting fetchAttempted`);
      fetchAttemptedRef.current = false;
    }
    
    return () => {
      logger.log(`[CommentPage] UNMOUNTING with commentId=${commentId}`);
    };
  }, [commentId]);

  // Проверка валидности commentId - перенаправляем если невалидный
  useEffect(() => {
    if (!commentId) {
      logger.error('[CommentPage] No commentId provided in URL parameters');
      // Если нет commentId, возвращаемся на главную страницу
      if (location.pathname.includes('/comment/')) {
        logger.warn('[CommentPage] Invalid URL, navigating to home');
        navigate('/', { replace: true });
      }
      setError('Comment ID is missing');
      setLoading(false);
      return;
    }
    
    // Если commentId есть, но в URL его нет, обновляем URL
    if (commentId && !location.pathname.includes(commentId)) {
      logger.log(`[CommentPage] Updating URL to match commentId: ${commentId}`);
      navigate(`/comment/${commentId}`, { 
        replace: true,
        state: location.state 
      });
    }
  }, [commentId, navigate, location.pathname, location.state]);

  // State management effect
  useEffect(() => {
    if (!commentId) {
      return;
    }
    
    logger.log(`[CommentPage] State management for comment slug=${commentId}`);
    
    // Сохраняем состояние из location или создаем дефолтное
    const stateToSave = location.state || 
      navigationStore.getStateForDirectUrl(location.pathname) || 
      { scrollPosition: 0, fromFeed: true, timestamp: Date.now() };
    
    logger.log(`[CommentPage] State from location:`, stateToSave);
    navigationStore.saveStateFromLocation(stateToSave);
    
    return () => {
      logger.log(`[CommentPage] Saving scroll position: ${window.scrollY}`);
      navigationStore.currentState.scrollPosition = window.scrollY;
    };
  }, [location.pathname, location.state, commentId]);

  // Socket availability check
  useEffect(() => {
    logger.log(`[CommentPage] Socket check: comments=${!!socketStore.comments}, connected=${socketStore.comments?.connected}`);
  }, []);

  // Эффект для загрузки комментария - зависит только от commentId
  useEffect(() => {
    if (!commentId) {
      logger.error('[CommentPage] No commentId for data loading');
      return;
    }
    
    let isMounted = true;
    logger.log(`[CommentPage] Starting to load comment data for: ${commentId}`);
    
    // Prevent duplicate fetches - теперь используем ref
    if (fetchAttemptedRef.current) {
      logger.log(`[CommentPage] Fetch already attempted, skipping`);
      return;
    }

    const loadComment = async () => {
      try {
        setLoading(true);
        setError(null);
        // Устанавливаем ref вместо state
        fetchAttemptedRef.current = true;

        logger.log(`[CommentPage] Loading comment by slug: ${commentId}`);
        logger.log(`[CommentPage] Socket connected: ${socketStore.comments?.connected}`);

        // 1. Сначала ищем комментарий в кэше
        let fetchedComment: Comment | null = commentStore.getCommentBySlug(commentId);
        logger.log(`[CommentPage] Cache lookup result: ${fetchedComment ? 'FOUND' : 'NOT FOUND'}`);

        if (!fetchedComment) {
          // Код загрузки комментария с сервера...
          logger.log(`[CommentPage] Comment not in cache, fetching by slug: ${commentId}`);
          
          // Проверяем состояние сокета перед запросом
          if (!socketStore.comments || !socketStore.comments.connected) {
            // Код ожидания подключения сокета...
            await new Promise<void>((resolve, reject) => {
              let attempts = 0;
              const maxAttempts = 50;
              
              const interval = setInterval(() => {
                attempts++;
                if (socketStore.comments?.connected) {
                  clearInterval(interval);
                  logger.log('[CommentPage] Socket connected, continuing');
                  resolve();
                } else if (attempts >= maxAttempts) {
                  clearInterval(interval);
                  logger.error('[CommentPage] Socket connection timeout');
                  reject(new Error('Socket connection timeout'));
                }
              }, 100);
            });
          }
          
          // Выполняем запрос
          logger.log('[CommentPage] Calling fetchCommentBySlug...');
          fetchedComment = await commentStore.fetchCommentBySlug(commentId);
          logger.log(`[CommentPage] Fetch result: ${fetchedComment ? 'SUCCESS' : 'FAILED'}`);
          
          // 3. Если все еще нет - пробуем по ID как fallback
          if (!fetchedComment) {
            logger.log(`[CommentPage] Comment not found by slug, trying by ID: ${commentId}`);
            fetchedComment = await commentStore.fetchComment(commentId);
            logger.log(`[CommentPage] Fetch by ID result: ${fetchedComment ? 'SUCCESS' : 'FAILED'}`);
          }
        } else {
          logger.log(`[CommentPage] Comment found in cache: ${fetchedComment.id}`);
        }

        if (!isMounted) {
          logger.warn('[CommentPage] Component unmounted during fetch, aborting');
          return;
        }

        if (!fetchedComment) {
          logger.error(`[CommentPage] Comment not found with id/slug: ${commentId}`);
          setError("Comment not found");
          setLoading(false);
          return;
        }

        logger.log(`[CommentPage] Successfully loaded comment: ${fetchedComment.id}`);
        setComment(fetchedComment);
        setLoading(false);
      } catch (error) {
        logger.error('[CommentPage] Error loading comment:', error);
        
        if (isMounted) {
          setError('Error loading comment');
          setLoading(false);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    // Execute load immediately
    loadComment();

    return () => {
      isMounted = false;
    };
  }, [commentId]); // Убрали repliesSort из зависимостей

  // Отдельный эффект для загрузки ответов на комментарий
  useEffect(() => {
    // Только если комментарий уже загружен и имеет ответы
    if (!comment || !comment.id || !comment.repliesCount) {
      return;
    }
    
    let isMounted = true;
    logger.log(`[CommentPage] Loading replies for comment: ${comment.id}`);
    
    const loadReplies = async () => {
      try {
        setRepliesLoading(true);
        await commentStore.loadComments(comment.id, 10, 1, repliesSort, true);
        logger.log(`[CommentPage] Replies loaded`);
        
        if (isMounted) {
          setRepliesLoading(false);
        }
      } catch (error) {
        logger.error('[CommentPage] Error loading replies:', error);
        if (isMounted) {
          setRepliesLoading(false);
        }
      }
    };
    
    loadReplies();
    
    return () => {
      isMounted = false;
    };
  }, [comment?.id, repliesSort]);

  const handleLoadMoreReplies = useCallback(() => {
    if (!comment?.id) return;
    
    const replies = commentStore.getReplies(comment.id);
    const page = Math.floor(replies.length / 10) + 1;
    
    logger.log(`[CommentPage] Loading more replies, page: ${page}`);
    setRepliesLoading(true);
    
    commentStore.loadComments(comment.id, 10, page, repliesSort, true) 
      .finally(() => {
        setRepliesLoading(false);
      });
  }, [comment?.id, repliesSort]);

  const handleSortChange = useCallback((sort: 'date' | 'likes') => {
    if (sort === repliesSort || !comment?.id) return;
    
    logger.log(`[CommentPage] Changing replies sort to: ${sort}`);
    setRepliesSort(sort);
    setRepliesLoading(true);
    
    commentStore.loadComments(comment.id, 10, 1, sort, true)
      .finally(() => {
        setRepliesLoading(false);
      });
  }, [comment?.id, repliesSort]);

  const handleRetry = useCallback(() => {
    if (!commentId) return;
    
    logger.log(`[CommentPage] Retrying fetch for comment: ${commentId}`);
    setLoading(true);
    setError(null);
    // Используем ref вместо state
    fetchAttemptedRef.current = false;
  }, [commentId]);

  // Обработчик возврата назад
  const handleBackClick = useCallback(() => {
    if (!commentId) return;
    
    logger.log(`[CommentPage] Back navigation requested from comment ${commentId}`);
    logger.log(`[CommentPage] Current scroll position: ${window.scrollY}`);
    
    const currentState = navigationStore.currentState;
    
    if (!location.state) {
      logger.log('[CommentPage] No location state, checking if comment belongs to post');
      
      if (comment?.postId) {
        logger.log(`[CommentPage] Comment belongs to post ${comment.postId}, navigating there`);
        
        // Передаем явное состояние для перехода на страницу поста
        const postState = {
          fromComment: true,
          commentId: commentId,
          postId: comment.postId,
          scrollPosition: 0,
          timestamp: Date.now()
        };
        
        // Сохраняем это состояние в navigationStore
        navigationStore.currentState = postState;
        
        navigate(`/post/${comment.postId}`, { 
          replace: true,
          state: postState
        });
        return;
      }
      
      logger.log('[CommentPage] No post association found, going to home');
      navigate('/', { replace: true });
      return;
    }
    
    if (currentState && (currentState.fromFeed || currentState.fromFollowing || currentState.fromUserProfile || currentState.fromPost)) {
      // Если возвращаемся на пост, явно устанавливаем признак, что это переход с комментария
      if (currentState.fromPost && currentState.postId) {
        currentState.fromComment = true;
      }
      
      logger.log(`[CommentPage] Using navigation store to handle back navigation`);
      navigationStore.handleBackNavigation(navigate);
    } else {
      logger.log(`[CommentPage] No specific navigation context, going back`);
      navigate(-1);
    }
  }, [commentId, navigate, location.state, comment]);

  // Обработчик успешного добавления ответа
  const handleReplySuccess = useCallback(() => {
    if (commentId) {
      logger.log("[CommentPage] Ответ добавлен");
      message.success('Ответ добавлен');
      
      // Прокручиваем к секции ответов
      setTimeout(() => {
        const repliesSection = document.querySelector('.comments-section');
        if (repliesSection) {
          repliesSection.scrollIntoView({ behavior: 'smooth' });
        }
      }, 300);
    }
  }, [commentId]);

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
          <p>Загрузка комментария...</p>
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Empty description={error} />
          <Button 
            type="primary" 
            onClick={handleRetry}
            style={{ marginTop: '16px' }}
          >
            Повторить попытку
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
                parentId={comment.id}
                postId={comment.postId}
                placeholder="Post your reply..."
                onSuccess={handleReplySuccess}
              />
            </div>
          )}

          <div className="comments-section">
            <CommentsThread 
              key={`replies-${comment.id}`}
              parentId={comment.id} 
              loading={repliesLoading}
              onLoadMore={handleLoadMoreReplies}
              onSortChange={handleSortChange}
            />
          </div>
        </>
      ) : (
        <Empty description="Комментарий не найден" />
      )}
    </section>
  );
});

export default CommentPage;