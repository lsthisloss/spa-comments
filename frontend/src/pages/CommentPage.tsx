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
import { reaction } from 'mobx';

/*
  Страница комментария, отображает отдельный комментарий и его ответы.
  Позволяет пользователю отправлять новые ответы и просматривать существующие.
*/
const CommentPage = observer(() => {
  // Получаем сторы через хуки
  const commentStore = useCommentStore();
  const userStore = useUserStore();
  const postStore = usePostStore();

  const { navigateToPost } = useNavigationHelper();
  const navigate = useNavigate();
  const params = useParams();

  // Для отслеживания монтирования компонента
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
  const [, setRepliesLoading] = useState(false);

  // Инициализация компонента
  useEffect(() => {
    mountedRef.current = true;
    logger.log(`[CommentPage] Component mounted for slug: ${commentSlug}`);

    return () => {
      mountedRef.current = false;
      commentStore.clearCurrentComment(); // Очищаем при размонтировании
      logger.log(`[CommentPage] Component unmounting for slug: ${commentSlug}`);
    };
  }, [commentSlug, commentStore]);

  // Подписываемся на изменения currentComment из store
  useEffect(() => {
    if (!comment?.id) return;

    // Слушаем изменения currentComment в store
    const disposer = reaction(
      () => commentStore.currentComment.get(),
      (currentComment) => {
        if (currentComment && currentComment.id === comment.id) {
          // Синхронизируем состояние с currentComment из store
          if (currentComment.likes !== comment.likes) {
            logger.log(`[CommentPage] Syncing with currentComment: likes ${comment.likes} -> ${currentComment.likes}`);
            setComment(currentComment);
          }
        }
      }
    );

    return disposer;
  }, [comment?.id, comment?.likes, commentStore]);

  useEffect(() => {
    if (!comment?.id) return;

    // Подписываемся на новые ответы к комментарию
    const handleNewReply = (newReply: Comment) => {
      logger.log(`[CommentPage] New reply received for comment ${comment.id}:`, newReply.id);
      // Ответы автоматически обновятся через MobX observable
    };

    commentStore.onNewComment(comment.id, handleNewReply);

    return () => {
      commentStore.offNewComment(comment.id);
    };
  }, [comment?.id, commentStore]);

  /*
    Эффект загрузки комментария по slug.
    Проверяем, что компонент смонтирован и slug не пустой.
    Если комментарий уже загружен, пропускаем повторную загрузку.
  */
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

          // Загружаем пост параллельно, если есть postId
          if (fetchedComment.postId && !postStore.postsMap.has(fetchedComment.postId)) {
            // Попробуем найти пост по postSlug в других местах или загрузить через postId
            const postInFeeds = postStore.feeds.feed.list.find(p => p.id === fetchedComment.postId) ||
              postStore.feeds.user.list.find(p => p.id === fetchedComment.postId);

            if (postInFeeds) {
              // Добавляем найденный пост в postsMap
              postStore.postsMap.set(fetchedComment.postId, postInFeeds);
              logger.log(`[CommentPage] Added post ${fetchedComment.postId} to postsMap from feeds`);
            } else if (fetchedComment.postSlug) {
              // Загружаем через postSlug
              postStore.fetchPostBySlug(fetchedComment.postSlug)
                .catch(err => {
                  if (mountedRef.current) {
                    logger.warn(`[CommentPage] Error loading post: ${err.message}`);
                  }
                });
            }
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

  // Обработчик повторной попытки 
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

  // Обработчик загрузки дополнительных ответов
  const handleLoadMoreReplies = useCallback(() => {
    if (!comment?.id) return;

    logger.log(`[CommentPage] Loading more replies for comment: ${comment.id}`);
    const replies = commentStore.getReplies(comment.id);
    const page = Math.floor(replies.length / 10) + 1;

    setRepliesLoading(true);

    // передаем isComment=true
    commentStore.loadComments(comment.id, 10, page, 'date', true)
      .finally(() => {
        setRepliesLoading(false);
      });
  }, [comment?.id, commentStore]);

  // Обработчик успешного создания ответа
  const handleReplySuccess = useCallback(() => {
    // Просто обновляем key CommentsThread для перезагрузки
    logger.log(`[CommentPage] Reply created successfully`);
  }, []);

  // Умная навигация назад к посту
  const handleGoBack = useCallback(() => {
    if (!comment) {
      navigate(-1);
      return;
    }

    logger.log(`[CommentPage] Comment postSlug: ${comment.postSlug}`);
    logger.log(`[CommentPage] Comment postId: ${comment.postId}`);

    if (comment.postSlug) {
      logger.log(`[CommentPage] Navigating back to parent post: ${comment.postSlug}`);
      navigateToPost(comment.postSlug, true); // Указываем что пришли с комментария
    } else if (comment.postId) {
      // Ищем пост по ID в уже загруженных данных
      const existingPost = postStore.postsMap.get(comment.postId);
      if (existingPost && existingPost.slug) {
        logger.log(`[CommentPage] Found existing post slug: ${existingPost.slug}`);
        navigateToPost(existingPost.slug, true); // Указываем что пришли с комментария
      } else {
        // Если пост не найден, просто используем браузерную навигацию
        logger.warn(`[CommentPage] Post not found for postId: ${comment.postId}, using browser back`);
        navigate(-1);
      }
    } else {
      navigate(-1);
    }
  }, [comment, navigate, navigateToPost, postStore]);

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
            <CommentsThread
              key={`replies-${comment.slug}`}
              parentSlug={comment.slug}
              loading={false}
              onLoadMore={handleLoadMoreReplies}
              autoLoad={true}
              enableNestedReplies={true}
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