import { useEffect, useState, useCallback } from 'react';
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

const CommentPage = observer(() => {
  const { commentId } = useParams<{ commentId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState<Comment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [repliesSort, setRepliesSort] = useState<'date' | 'likes'>('date'); // Добавьте это состояние

  // обработчик загрузки дополнительных ответов
  const handleLoadMoreReplies = useCallback(() => {
    if (!commentId) return;
    
    const replies = commentStore.getReplies(commentId);
    const page = Math.floor(replies.length / 10) + 1;
    
    logger.log(`[CommentPage] Loading more replies, page: ${page}`);
    setRepliesLoading(true);
    
    commentStore.loadComments(commentId, 10, page, repliesSort, true) 
      .finally(() => {
        setRepliesLoading(false);
      });
  }, [commentId, repliesSort]);

  // Обработчик изменения сортировки ответов
  const handleSortChange = useCallback((sort: 'date' | 'likes') => {
    if (sort === repliesSort || !commentId) return;
    
    logger.log(`[CommentPage] Changing replies sort to: ${sort}`);
    setRepliesSort(sort);
    setRepliesLoading(true);
    
    commentStore.loadComments(commentId, 10, 1, sort, true)
      .finally(() => {
        setRepliesLoading(false);
      });
  }, [commentId, repliesSort]);

  // Навигационное состояние
  useEffect(() => {
    logger.log(`[CommentPage] Mount with commentId=${commentId}, has location state: ${!!location.state}`);
    
    if (location.state) {
      logger.log('[CommentPage] Saving navigation state from location');
      navigationStore.saveStateFromLocation(location.state);
    } else {
      logger.log('[CommentPage] Direct URL navigation, checking for saved state');
      const savedState = navigationStore.getStateForDirectUrl(location.pathname);
      if (savedState) {
        logger.log('[CommentPage] Found saved state for direct URL');
        navigationStore.saveStateFromLocation(savedState);
      } else {
        logger.log('[CommentPage] No saved state found, creating default state');
        navigationStore.currentState = {
          scrollPosition: 0,
          timestamp: Date.now(),
          navigationType: 'direct-url-comment'
        };
      }
    }
    
    return () => {
      logger.log('[CommentPage] Unmounting');
    };
  }, [location.state, location.pathname, commentId]);

 
  useEffect(() => {
    if (!commentId) return;

    const loadComment = async () => {
      try {
        setLoading(true);
        setError(null);
        
        logger.log(`[CommentPage] Loading comment ${commentId}`);
        const fetchedComment = await commentStore.fetchComment(commentId);
        
        if (fetchedComment) {
          setComment(fetchedComment);
          
          // Явно загружаем ответы сразу после загрузки комментария
          logger.log(`[CommentPage] Loading replies ${commentId}`);
          setRepliesLoading(true);
          await commentStore.loadComments(commentId, 10, 1, repliesSort, true);
          setRepliesLoading(false);
        } else {
          setError('[CommentPage] Comment not found');
        }
      } catch (error) {
        setError('[CommentPage] Error loading comment');
        logger.error('[CommentPage] Err:', error);
      } finally {
        setLoading(false);
      }
    };

    loadComment();
  }, [commentId, repliesSort]);

  // Сохранение позиции скролла при размонтировании
  useEffect(() => {
    return () => {
      logger.log(`[CommentPage] Unmounting, saving current scroll position`);
      const currentScrollPosition = window.scrollY;
      if (navigationStore.currentState) {
        navigationStore.currentState.scrollPosition = currentScrollPosition;
      }
    };
  }, []);

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
        navigate(`/post/${comment.postId}`, { replace: true });
        return;
      }
      
      logger.log('[CommentPage] No post association found, going to home');
      navigate('/', { replace: true });
      return;
    }
    
    if (currentState && (currentState.fromFeed || currentState.fromFollowing || currentState.fromUserProfile || currentState.fromPost)) {
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
      logger.log("CommentPage: Ответ добавлен");
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

  // Обработчик повторной попытки
  const handleRetry = useCallback(() => {
    if (!commentId) return;
    
    setLoading(true);
    setError(null);
    
    commentStore.fetchComment(commentId)
      .then(fetchedComment => {
        if (fetchedComment) {
          setComment(fetchedComment);
        } else {
          setError('Комментарий не найден');
        }
      })
      .catch(error => {
        setError('Ошибка загрузки комментария');
        logger.error('Ошибка загрузки комментария:', error);
      })
      .finally(() => {
        setLoading(false);
      });
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
                parentId={commentId}
                postId={comment.postId}
                placeholder="Post your reply..."
                onSuccess={handleReplySuccess}
              />
            </div>
          )}

         <div className="comments-section">
          <CommentsThread 
            key={`replies-${commentId}`}
            parentId={commentId} 
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