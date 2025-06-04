import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { useParams, useNavigate } from 'react-router-dom';
import { Empty, Button, Spin } from 'antd';
import { LeftOutlined, HomeOutlined } from '@ant-design/icons';
import { useCommentStore, useUserStore, usePostStore } from '../hooks/useStore';
import { Comment } from '../types/interfaces';
import { logger } from '../utils/Logger';
import { useNavigationHelper } from '../hooks/useNavigationHelper';
import CommentItem from '../components/comments/CommentsItem';
import SendForm from '../components/common/SendForm';
import CommentsThread from '../components/comments/CommentsThread';

const CommentPage = observer(() => {
  // Получаем сторы через хуки
  const commentStore = useCommentStore();
  const userStore = useUserStore();
  const postStore = usePostStore();
  
  const navigationHelper = useNavigationHelper();
  
  const navigate = useNavigate();
  const params = useParams();
  
  // REF ДЛЯ ОТСЛЕЖИВАНИЯ МОНТИРОВАНИЯ
  const mountedRef = useRef(true);
  
  // Получаем slug комментария из URL
const commentSlug = useMemo(() => {
  logger.log('[CommentPage] URL params:', params);
  
  if (params.slug) {
    logger.log('[CommentPage] Using params.slug:', params.slug);
    return params.slug;
  }
}, [params]);
  
  // Состояние компонента
  const commentFetchedRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState<Comment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [repliesSort, setRepliesSort] = useState<'date' | 'likes'>('date');
  const [, setRepliesLoading] = useState(false);
  
  // Инициализация компонента
  useEffect(() => {
    mountedRef.current = true;
    logger.log(`[CommentPage] Component mounted for slug: ${commentSlug}`);
    
    return () => {
      mountedRef.current = false;
      logger.log(`[CommentPage] Component unmounting for slug: ${commentSlug}`);
    };
  }, [commentSlug]);
  
  // Загрузка комментария 
  useEffect(() => {
    if (!commentSlug || !mountedRef.current) {
      logger.log(`[CommentPage] No commentSlug provided or component not mounted`);
      return;
    }
    
    // Предотвращаем повторную загрузку того же комментария
    if (commentFetchedRef.current === commentSlug) {
      logger.log(`[CommentPage] Comment ${commentSlug} already fetched, skipping`);
      return;
    }
    
    setLoading(true);
    setError(null);
    commentFetchedRef.current = null;
    
    logger.log(`[CommentPage] Loading comment with slug: ${commentSlug}`);
    
    // Загрузка комментария по slug
    commentStore.fetchCommentBySlug(commentSlug)
      .then(fetchedComment => {
        if (!mountedRef.current) {
          logger.log(`[CommentPage] Component unmounted during fetch, aborting state updates`);
          return;
        }
        
        if (fetchedComment) {
          logger.log(`[CommentPage] Comment found: ${fetchedComment.id}`);
          setComment(fetchedComment);
          setLoading(false);
          commentFetchedRef.current = commentSlug;
          
          // Загружаем пост, к которому относится комментарий
          if (fetchedComment.postSlug) {
            postStore.fetchPostBySlug(fetchedComment.postSlug)
              .catch(err => {
                if (mountedRef.current) {
                  logger.warn(`[CommentPage] Error loading post: ${err.message}`);
                }
              });
          }
        } else {
          setError('Comment not found');
          setLoading(false);
          logger.error(`[CommentPage] Comment not found with slug: ${commentSlug}`);
        }
      })
      .catch(err => {
        if (!mountedRef.current) {
          logger.log(`[CommentPage] Component unmounted during error handling, aborting state updates`);
          return;
        }
        
        logger.error(`[CommentPage] Error loading comment: ${err.message}`);
        setError('Failed to load comment');
        setLoading(false);
      });
  }, [commentSlug, commentStore, postStore]);

  // Обработчик повторной попытки - ДОБАВЛЯЕМ ПРОВЕРКУ МОНТИРОВАНИЯ
  const handleRetry = useCallback(() => {
    if (!commentSlug || !mountedRef.current) return;
    
    setLoading(true);
    setError(null);
    commentFetchedRef.current = null;
    
    logger.log(`[CommentPage] Retrying to load comment with slug: ${commentSlug}`);
    
    commentStore.fetchCommentBySlug(commentSlug)
      .then(fetchedComment => {
        if (!mountedRef.current) return;
        
        if (fetchedComment) {
          setComment(fetchedComment);
          setLoading(false);
          commentFetchedRef.current = commentSlug;
          
          if (fetchedComment.postSlug) {
            postStore.fetchPostBySlug(fetchedComment.postSlug)
              .catch(err => {
                if (mountedRef.current) {
                  logger.warn(`[CommentPage] Error loading post: ${err.message}`);
                }
              });
          }
        } else {
          setError('Comment not found');
          setLoading(false);
        }
      })
      .catch(err => {
        if (!mountedRef.current) return;
        
        logger.error(`[CommentPage] Error loading comment: ${err.message}`);
        setError('Failed to load comment');
        setLoading(false);
      });
  }, [commentSlug, commentStore, postStore]);

  // Обработчик смены сортировки ответов
const handleSortChange = useCallback((sort: 'date' | 'likes') => {
  logger.log(`[CommentPage] Setting local sort to ${sort} - NO SERVER REQUEST`);
  setRepliesSort(sort);
}, []);
  // Обработчик загрузки дополнительных ответов
  const handleLoadMoreReplies = useCallback(() => {
    if (!comment?.id) return;
    
    logger.log(`[CommentPage] Loading more replies for comment: ${comment.id}`);
    const replies = commentStore.getReplies(comment.id);
    const page = Math.floor(replies.length / 10) + 1;
    
    setRepliesLoading(true);
    
    commentStore.loadComments(comment.id, 10, page, repliesSort, true)
      .finally(() => {
        setRepliesLoading(false);
      });
  }, [comment?.id, repliesSort, commentStore]);

  // Обработчик успешного создания ответа
  const handleReplySuccess = useCallback(() => {
    // Просто обновляем key CommentsThread для перезагрузки
    logger.log(`[CommentPage] Reply created successfully`);
  }, []);


  // Обработчик возврата назад
  const handleGoBack = useCallback(() => {
  if (!comment) {
    // Если комментарий еще не загружен, используем обычную навигацию назад
    navigationHelper.goBack();
    return;
  }
  
  // Если есть информация о родительском посте, возвращаемся к нему
  if (comment.postSlug) {
    logger.log(`[CommentPage] Navigating back to parent post: ${comment.postSlug}`);
    navigate(`/post/${comment.postSlug}`, {
      replace: true,
      state: {
        fromComment: true,
        commentId: comment.id
      }
    });
  } else {
    // Если нет информации о посте, используем общий механизм
    navigationHelper.goBack();
  }
}, [comment, navigate, navigationHelper]);

  return (
    <section className="post-page-container">
      <div className="post-header">
        <Button
          type="text"
          icon={<LeftOutlined />}
          onClick={handleGoBack}
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

          {/* Секция ответов */}
          <div className="comments-section">
            {comment.repliesCount && comment.repliesCount > 0 ? (
                <CommentsThread 
                  key={`replies-${comment.slug}`}
                  parentSlug={comment.slug}
                  loading={false}
                  onLoadMore={handleLoadMoreReplies}
                  onSortChange={handleSortChange}
                  autoLoad={true}
                  enableNestedReplies={true}
                />
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <Empty 
                  description="No replies yet"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              </div>
            )}
          </div>
        </>
      ) : (
        <Empty description="Comment not found" />
      )}
    </section>
  );
});

export default CommentPage;