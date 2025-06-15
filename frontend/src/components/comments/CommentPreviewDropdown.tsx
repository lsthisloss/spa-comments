import React, { useState, useEffect, memo, useCallback, useRef, useMemo } from 'react';
import { Dropdown, Typography, Avatar, Space, Card, Button, Spin, Empty } from 'antd';
import { Comment } from '../../types/interfaces';
import { getAvatarColor } from '../ui/particles/avatarColor';
import { observer } from 'mobx-react-lite';
import { logger } from '../../utils/Logger';
import AdminBadge from '../ui/particles/AdminBadge';
import { useCommentStore, usePostStore, useUserStore, } from '../../hooks/useStore';
import useNavigation from '../../hooks/useNavigation';

/*  
  Компонент для отображения превью комментария в выпадающем списке.
  Используется для быстрого просмотра комментариев к постам или ответам на комментарии.
  Позволяет кликнуть по превью и перейти к полному комментарию.
*/
const CommentPreview = memo(({ comment, onClick }: {
  comment: Comment;
  onClick: (id: string) => void;
}) => {

  // Используем MobX для доступа к хранилищу пользователей
  const userStore = useUserStore();

  /*
    Определяем аватар пользователя:
    - Если есть avatarUrl, используем его
    - Иначе берем первую букву имени пользователя или 'Anonymous'
    - Определяем форму аватара (круглая или квадратная)
  */
  const avatarLetter = (comment.user?.userName?.[0] || comment.userName?.[0] || '?').toUpperCase();
  const avatarUrl = comment.user?.avatarUrl;
  const avatarShape = comment.user?.avatarShape || 'circle';

  // Определяем роль пользователя для отображения бейджа администратора
  const userRole = useMemo(() => {
    // Сначала из comment.user
    if (comment.user?.role) return comment.user.role;

    // Потом из кэша
    if (comment.user?.id) {
      const cachedUser = userStore.getCachedUser(comment.user.id);
      if (cachedUser?.role) return cachedUser.role;
    }

    return 'user';
  }, [comment.user?.role, comment.user?.id, userStore]);

  // Truncate 
  const content = comment.content.length > 60
    ? `${comment.content.substring(0, 60)}...`
    : comment.content;

  // Event хендлер для клика по превью комментария
  const handleClick = useCallback(() => onClick(comment.id), [comment.id, onClick]);

  // Рендеринг компонента
  return (
    <div className="comment-preview-item" onClick={handleClick}>
      <Space size={8} align="start" className="comment-preview-space">
        {/* Avatar */}
        {avatarUrl ? (
          <Avatar
            size="small"
            src={avatarUrl}
            className="comment-preview-avatar"
            shape={avatarShape === 'square' ? 'square' : 'circle'}
          />
        ) : (
          <Avatar
            size="small"
            style={{
              backgroundColor: getAvatarColor(avatarLetter),
              borderRadius: avatarShape === 'square' ? '4px' : '50%'
            }}
            className="comment-preview-avatar"
          >
            {avatarLetter}
          </Avatar>
        )}

        {/* Content */}
        <div className="comment-preview-content">
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
            <Typography.Text strong className="comment-preview-username">
              {comment.user?.userName || comment.userName || 'Anonymous'}
            </Typography.Text>
            <AdminBadge role={userRole} className="preview-admin-badge" />
          </div>
          <Typography.Paragraph
            ellipsis={{ rows: 2 }}
            className="comment-preview-text"
          >
            <div dangerouslySetInnerHTML={{ __html: content }} />
          </Typography.Paragraph>
        </div>

      </Space>
    </div>
  );
});

interface CommentPreviewDropdownProps {
  children: React.ReactNode;
  postSlug: string;
}

/*
  Компонент для отображения выпадающего списка с превью комментариев к посту или ответам на комментарий.
  Позволяет пользователю быстро просмотреть топ комментарии и перейти к полному списку.
*/
const CommentPreviewDropdown = observer(({ children, postSlug }: CommentPreviewDropdownProps) => {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const isMountedRef = useRef(true);
  const postStore = usePostStore();
  const commentStore = useCommentStore();
  const { navigateToEntity } = useNavigation();

  // Лайфхук для отслеживания монтирования компонента
  // Используем useRef для хранения состояния монтирования
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Сброс состояния при смене postSlug
  useEffect(() => {
    setHasLoaded(false);
    setLoading(false);
  }, [postSlug]);

  // Получаем пост или комментарий по слагу
  const post = postStore.getPostBySlug(postSlug);
  const comment = !post ? commentStore.getCommentBySlug(postSlug, false) : null;

  // Детерминируем тип сущности (пост или комментарий)
  const entityType = post ? 'post' : (comment ? 'comment' : null);
  const entity = post || comment;

  // Обьявляем функцию для навигации к сущности
  const comments = useMemo(() => {
    if (!entity || !hasLoaded) return []; // Возвращаем пустой массив если не загружали

    return entityType === 'post' && post
      ? commentStore.getComments(post.id)
      : (entityType === 'comment' && comment ? commentStore.getReplies(comment.id) : []);
  }, [entityType, entity, post, comment, commentStore, hasLoaded]);

  // Top comments (sorted by likes) - ТОЛЬКО если загружены
  const topComments = useMemo(() => {
    if (!hasLoaded || comments.length === 0) return [];

    return [...comments]
      .sort((a, b) => (b.likes || 0) - (a.likes || 0))
      .slice(0, 3);
  }, [comments, hasLoaded]);


  // Load comments ТОЛЬКО при открытии dropdown
  const loadCommentsOnOpen = useCallback(async () => {
    if (!isMountedRef.current || hasLoaded || loading || !entity) return;

    setLoading(true);

    try {
      if (entityType === 'post' && post) {
        // Проверяем, загружены ли уже комментарии
        const alreadyLoaded = commentStore.hasLoadedCommentsFor(post.id);
        if (!alreadyLoaded) {
          await commentStore.loadComments(post.id, 10, 1, 'likes', false);
        }
      } else if (entityType === 'comment' && comment) {
        const alreadyLoaded = commentStore.hasLoadedRepliesFor(comment.id);
        if (!alreadyLoaded) {
          await commentStore.loadComments(comment.id, 10, 1, 'likes', true);
        }
      }

      setHasLoaded(true);
    } catch (error) {
      logger.error('[CommentPreviewDropdown] Failed to load comments:', error);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [hasLoaded, loading, entityType, entity, post, comment, commentStore]);

  // Хендлер для изменения видимости dropdown
  const handleVisibleChange = useCallback((newVisible: boolean) => {
    if (!isMountedRef.current) return;

    setVisible(newVisible);

    // ЗАГРУЖАЕМ комментарии ТОЛЬКО при открытии
    if (newVisible && !hasLoaded && !loading && entity) {
      loadCommentsOnOpen();
    }
  }, [hasLoaded, loading, loadCommentsOnOpen, entity]);

  // Хендлер для клика по комментарию
  const handleCommentClick = useCallback((commentId: string) => {
    if (!isMountedRef.current) return;

    const comment = commentStore.getItemById(commentId);
    if (!comment?.slug) return;

    setVisible(false);
    navigateToEntity('comment', comment.slug);
  }, [navigateToEntity, commentStore]);

  // Handle "View all" click
  const handleViewAll = useCallback(() => {
    if (!isMountedRef.current) return;

    setVisible(false);
    navigateToEntity(entityType as 'post' | 'comment', postSlug);
  }, [navigateToEntity, entityType, postSlug]);

  // Не показываем dropdown, если нет сущности
  if (!entity) return null;

  // Контент для выпадающего списка
  const dropdownContent = (
    <Card size="small" variant="borderless" className="comment-preview-card">
      {loading ? (
        <div className="comment-preview-loading">
          <Spin size="small" />
          <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
            Loading...
          </Typography.Text>
        </div>
      ) : topComments.length > 0 ? (
        <>
          <div className="comment-preview-list">
            {topComments.map((comment) => (
              <CommentPreview
                key={comment.id}
                comment={comment}
                onClick={handleCommentClick}
              />
            ))}
          </div>
          <div className="comment-preview-footer">
            <Button
              type="link"
              size="small"
              onClick={handleViewAll}
              className="comment-preview-view-all"
            >
              {entityType === 'post' ? 'View all comments' : 'View all replies'}
            </Button>
          </div>
        </>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Typography.Text className="comment-preview-text">
              {hasLoaded ?
                `${entityType === 'post' ? 'No comments yet' : 'No replies yet'}` :
                'Comments not loaded'
              }
            </Typography.Text>
          }
          className="comment-preview-empty"
        />
      )}
    </Card>
  );

  // Jcновной рендеринг выпадающего списка с превью комментариев
  return (
    <Dropdown
      open={visible}
      onOpenChange={handleVisibleChange}
      trigger={['click']}
      popupRender={() => dropdownContent}
      placement="bottomRight"
      arrow
      destroyOnHidden={true}
      overlayClassName="comment-preview-dropdown"
      overlayStyle={{ width: 'auto' }}
    >
      {children}
    </Dropdown>
  );
});


export default CommentPreviewDropdown;