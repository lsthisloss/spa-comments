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
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState<Comment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [repliesSort, setRepliesSort] = useState<'date' | 'likes'>('date');
  const { commentId } = useParams(); // commentId теперь это slug

  // Обработчик изменения сортировки ответов
  useEffect(() => {
    if (!commentId) return;

    const loadComment = async () => {
      try {
        setLoading(true);
        setError(null);
        
        logger.log(`[CommentPage] Loading comment by slug: ${commentId}`);
        
        let fetchedComment: Comment | null = commentStore.getCommentBySlug(commentId) || null;
        
        if (fetchedComment) {
          logger.log(`[CommentPage] Found comment by slug in cache: ${fetchedComment.id}`);
          setComment(fetchedComment);
          
          // Загружаем ответы для найденного комментария
          logger.log(`[CommentPage] Loading replies for comment ${fetchedComment.id}`);
          setRepliesLoading(true);
          await commentStore.loadComments(fetchedComment.id, 10, 1, repliesSort, true);
          setRepliesLoading(false);
        } else {
          // Если не найден в кэше, запрашиваем с backend по slug
          logger.log(`[CommentPage] Comment not found in cache, fetching from server by slug: ${commentId}`);
          
          // Проверяем, существует ли метод fetchCommentBySlug
          if (typeof commentStore.fetchCommentBySlug === 'function') {
            fetchedComment = await commentStore.fetchCommentBySlug(commentId);
          } else {
            // Fallback: попробуем найти по ID если slug не работает
            logger.warn(`[CommentPage] fetchCommentBySlug method not available, trying fetchComment`);
            fetchedComment = await commentStore.fetchComment(commentId);
          }
          
          if (fetchedComment) {
            logger.log(`[CommentPage] Successfully fetched comment: ${fetchedComment.id}`);
            setComment(fetchedComment);
            
            // Загружаем ответы
            logger.log(`[CommentPage] Loading replies for fetched comment ${fetchedComment.id}`);
            setRepliesLoading(true);
            await commentStore.loadComments(fetchedComment.id, 10, 1, repliesSort, true);
            setRepliesLoading(false);
          } else {
            logger.warn(`[CommentPage] Comment with slug/id ${commentId} not found`);
            setError('Comment not found');
          }
        }
      } catch (error) {
        setError('Error loading comment');
        logger.error('[CommentPage] Error loading comment:', error);
      } finally {
        setLoading(false);
      }
    };

    loadComment();
  }, [commentId, repliesSort]);

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
    
    setLoading(true);
    setError(null);
    
    // Сначала пробуем по slug, потом по ID
    const tryFetch = async () => {
      let fetchedComment: Comment | null = null;
      
      // Пробуем по slug
      if (typeof commentStore.fetchCommentBySlug === 'function') {
        fetchedComment = await commentStore.fetchCommentBySlug(commentId);
      }
      
      // Если не получилось, пробуем по ID
      if (!fetchedComment) {
        fetchedComment = await commentStore.fetchComment(commentId);
      }
      
      return fetchedComment;
    };
    
    tryFetch()
      .then(fetchedComment => {
        if (fetchedComment) {
          setComment(fetchedComment);
        } else {
          setError('Comment not found');
        }
      })
      .catch(error => {
        setError('Error loading comment');
        logger.error('Error loading comment:', error);
      })
      .finally(() => {
        setLoading(false);
      });
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
        navigate(`/post/${comment.slug}`, { replace: true });
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