import { useCallback, useEffect, useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Empty, Badge } from 'antd';
import { useCommentsFeed } from '../../hooks/useFeedItems';
import VirtualList from '../common/VirtualList';
import CommentItem from './CommentsItem';
import { Comment } from '../../types/interfaces';
import { logger } from '../../utils/Logger';
import { useCommentStore, usePostStore } from '../../hooks/useStore';

/*
  Компонент для отображения потока комментариев к посту или ответов на комментарий.
  Используется в ленте комментариев и на страницах постов.
  Позволяет загружать и отображать комментарии, а также их ответы.
  Использует виртуальный список, mобx для управления состоянием и ангулярные компоненты для UI.
*/
interface CommentsThreadProps {
  postId?: string;
  postSlug?: string;
  parentId?: string;
  parentSlug?: string;
  loading?: boolean;
  onLoadMore?: () => void;
  autoLoad?: boolean;
  enableNestedReplies?: boolean;
}

const CommentsThread = observer(({
  postId,
  postSlug,
  parentId,
  parentSlug,
  loading = false,
  onLoadMore,
  autoLoad = true,
  enableNestedReplies = false,
}: CommentsThreadProps) => {
  // Используем MobX для доступа к хранилищам комментариев и постов
  const commentStore = useCommentStore();
  const postStore = usePostStore();
  const [triedAutoLoad, setTriedAutoLoad] = useState(false);

  /*
    Функция для разрешения ID поста или комментария.
    Если ID не указаны, пытаемся найти их по слагам.
    Возвращает объект с целевым ID и флагом, является ли это постом.
  */
  const resolveEntityIds = useMemo(() => {
    let effectivePostId = postId;
    let effectiveParentId = parentId;

    // Если ID не указаны, пытаемся найти их по слагам
    if (!effectivePostId && postSlug) {
      const post = postStore.getPostBySlug(postSlug);
      effectivePostId = post?.id;
    }

    // Если ID комментария не указан, пытаемся найти его по слагу
    if (!effectiveParentId && parentSlug) {
      const comment = commentStore.getCommentBySlug(parentSlug, false);
      effectiveParentId = comment?.id;
    }
    // Если оба ID не указаны, пытаемся найти по слагам в постах
    const targetId = effectivePostId || effectiveParentId;
    // isPost определяет, является ли целевой ID постом или комментарием
    const isPost = !!effectivePostId;

    return { targetId, isPost, effectivePostId, effectiveParentId };
  }, [postId, postSlug, parentId, parentSlug, postStore, commentStore]);

  // Извлекаем целевой ID и флаг поста из разрешенных ID
  const { targetId, isPost } = resolveEntityIds;

  if (!targetId) {
    return <Empty description="No post or comment ID specified" />;
  }

  /*
    Обработчик для получения новых комментариев или ответов.
    Подписываемся на события новых комментариев в хранилище.
    Если целевой ID не указан, ничего не делаем.
    Если проверка прошла, логируем получение нового комментария.
    Используем useEffect для подписки на события.
  */
  useEffect(() => {
    if (!targetId) return;

    const handleNewComment = (newComment: Comment) => {
      logger.log(`[CommentsThread] New comment received for ${targetId}:`, newComment.id);
    };

    commentStore.onNewComment(targetId, handleNewComment);
    return () => commentStore.offNewComment(targetId);
  }, [targetId, commentStore]);

  // Получаем список комментариев или ответов в зависимости от типа
  const comments = isPost ? commentStore.getComments(targetId) : commentStore.getReplies(targetId);
  // Получаем общее количество комментариев или ответов
  const totalComments = isPost ? commentStore.getTotalComments(targetId) : commentStore.getTotalReplies(targetId);
  // Получаем функции для оценки высоты элемента и ключа элемента
  const { estimateItemHeight, getItemKey } = useCommentsFeed();


  /*
    Автоматическая загрузка комментариев или ответов при монтировании компонента.
    Проверяем, нужно ли загружать комментарии автоматически.
    Если авто-загрузка отключена или целевой ID не указан, ничего не делаем.
    Если это пост, проверяем, есть ли уже комментарии.
    Если комментариев нет, загружаем их через onLoadMore или по слагу поста.
    Если это ответ на комментарий, проверяем наличие ответов и загружаем их аналогично.
  */
  useEffect(() => {
    if (autoLoad === false || !targetId || triedAutoLoad) return;

    logger.log(`[CommentsThread] Auto-load check for targetId: ${targetId}, isPost: ${isPost}`);

    if (isPost) {
      const existingComments = commentStore.getComments(targetId);
      const hasComments = existingComments && existingComments.length > 0;

      if (!hasComments) {
        setTriedAutoLoad(true);
        logger.log(`[CommentsThread] Auto-loading comments for post: ${targetId}`);

        if (onLoadMore) {
          onLoadMore();
        } else if (postSlug) {
          commentStore.loadCommentsBySlug(postSlug, 10, 1, 'date')
            .then(() => logger.log(`[CommentsThread] Comments loaded for post slug: ${postSlug}`))
            .catch((error) => logger.error(`[CommentsThread] Failed to load comments for post slug ${postSlug}:`, error));
        } else {
          logger.warn(`[CommentsThread] No postSlug provided for auto-loading comments`);
        }
      }
    } else {
      logger.log(`[CommentsThread] Loading replies for comment: ${targetId}`);

      const existingReplies = commentStore.getReplies(targetId);
      logger.log(`[CommentsThread] Current replies count: ${existingReplies.length}`);

      if (existingReplies.length === 0) {
        setTriedAutoLoad(true);
        logger.log(`[CommentsThread] Auto-loading replies for comment: ${targetId}`);

        if (onLoadMore) {
          onLoadMore();
        } else {
          commentStore.loadComments(targetId, 10, 1, 'date', true);
        }
      }
    }
  }, [autoLoad, targetId, isPost, postSlug, onLoadMore, commentStore, triedAutoLoad]);

  // Функция для рендеринга каждого комментария или ответа
  // Используем useCallback для оптимизации производительности
  const renderComment = useCallback((item: Comment, index: number) => {
    return (
      <div
        data-virtual-index={index}
        style={{ marginBottom: '8px' }}
      >
        <CommentItem
          item={item}
          disableNestedComments={enableNestedReplies ? false : !isPost}
        />
      </div>
    );
  }, [isPost, enableNestedReplies]);

  const headerComponent = (
    <div style={{ padding: '16px', borderBottom: '1px solid #f0f0f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '14px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>{isPost ? 'Comments' : 'Replies'}</span>
          <Badge count={totalComments} size="small" style={{ marginLeft: '4px' }} />
        </div>
      </div>
    </div>
  );

  //Оснвной рендеринг компонента
  return (
    <div className="comments-thread">
      {headerComponent}
      <VirtualList
        items={comments}
        renderItem={renderComment}
        getItemKey={getItemKey}
        estimateItemHeight={estimateItemHeight}
        onEndReached={onLoadMore}
        loading={loading}
        allLoaded={comments.length >= totalComments}
        feedContextId={`comments-${targetId}`}
        debugOptions={{
          feedType: 'comments',
          targetId,
          isPost,
          totalComments,
          currentPage: Math.ceil(comments.length / 20),
          loadedCount: comments.length,
          contextType: 'comments',
          postId,
          postSlug,
          parentId,
          parentSlug,
          enableNestedReplies,
          autoLoad,
        }}
      />
    </div>
  );
});

export default CommentsThread;