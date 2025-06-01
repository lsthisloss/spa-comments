import React, { useState, useEffect, memo, useCallback, useRef } from 'react';
import { Dropdown, Typography, Avatar, Space, Card, Button, Spin, Empty } from 'antd';
import { LikeOutlined, LikeFilled, MessageOutlined } from '@ant-design/icons';
import { Comment } from '../../types/interfaces';
import userStore from '../../services/stores/UserStore';
import { commentStore } from '../../services/stores/CommentStore';
import { getAvatarColor } from '../ui/particles/avatarColor';
import { useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { logger } from '../../utils/Logger';
import { postStore } from '../../services/stores/PostStore';

const CommentPreview = memo(({ comment, onClick, onLike, isLiked }: {
  comment: Comment;
  onClick: (id: string) => void;
  onLike: (commentId: string) => void;
  isLiked: boolean;
}) => {
  const [avatarError, setAvatarError] = useState(false);
  const isMountedRef = useRef(true);
  
  const avatarLetter = (comment.user?.userName?.[0] || comment.userName?.[0] || '?').toUpperCase();
  const avatarUrl = comment.user?.avatarUrl;
  const avatarShape = comment.user?.avatarShape || 'circle';
  
  const content = comment.content.length > 60 
    ? `${comment.content.substring(0, 60)}...` 
    : comment.content;
  
  useEffect(() => {
    isMountedRef.current = true;
    setAvatarError(false);
    
    return () => {
      isMountedRef.current = false;
    };
  }, [comment.id]);
  
  const handleAvatarError = useCallback(() => {
    if (isMountedRef.current) {
      logger.warn(`Avatar failed to load for user: ${comment.userName || 'unknown'}`);
      setAvatarError(true);
    }
    return true;
  }, [comment.userName]);
  
  const handleClick = useCallback(() => {
    if (isMountedRef.current) {
      onClick(comment.id);
    }
  }, [comment.id, onClick]);
  
  const handleLikeClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMountedRef.current) {
      onLike(comment.id);
    }
  }, [comment.id, onLike]);
  
  if (!isMountedRef.current) {
    return null;
  }
  
  return (
    <div 
      className="comment-preview-item"
      onClick={handleClick}
    >
      <Space size={8} align="start" className="comment-preview-space">
        {avatarUrl && !avatarError ? (
          <Avatar
            size="small"
            src={avatarUrl}
            onError={handleAvatarError}
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
        
        <div className="comment-preview-content">
          <Typography.Text strong className="comment-preview-username">
            {comment.user?.userName || comment.userName || 'Anonymous'}
          </Typography.Text>
          <Typography.Paragraph 
            ellipsis={{ rows: 2 }} 
            className="comment-preview-text"
          >
            <div dangerouslySetInnerHTML={{ __html: content }} />
          </Typography.Paragraph>
        </div>
        <Button 
          type="text"
          size="small"
          icon={isLiked 
            ? <LikeFilled className="heart-icon liked" /> 
            : <LikeOutlined className="heart-icon" />
          }
          onClick={handleLikeClick}
          className="comment-preview-like-button"
        >
          <span>{comment.likes || comment.likedUserIds?.length || 0}</span>
        </Button>
      </Space>
    </div>
  );
});

interface CommentPreviewDropdownProps {
  children: React.ReactNode;
  postSlug: string;
}

const CommentPreviewDropdown = observer(({ children, postSlug }: CommentPreviewDropdownProps) => {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const isMountedRef = useRef(true);
  
  const userId = userStore.user?.id;
  const navigate = useNavigate();
  
  // Cleanup при unmount
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // Сброс hasLoaded при смене postSlug
  useEffect(() => {
    setHasLoaded(false);
    setLoading(false);
  }, [postSlug]);
  
  // ПОЛУЧАЕМ ДАННЫЕ ИЗ КЭША - observer-реактивно БЕЗ useMemo
  const post = postStore.getPostBySlug(postSlug);
  const comment = !post ? commentStore.getCommentBySlug(postSlug) : null;
  
  // Определяем тип и получаем комментарии НАПРЯМУЮ (observer-реактивно)
  let entityType: 'post' | 'comment' | null = null;
  let entity = null;
  let comments: Comment[] = [];
  
  if (post) {
    entityType = 'post';
    entity = post;
    comments = commentStore.getComments(post.id);
  } else if (comment) {
    entityType = 'comment';
    entity = comment;
    comments = commentStore.getReplies(comment.id);
  }
  
  // Логируем для отладки
  logger.log(`[CommentPreviewDropdown] Entity type: ${entityType}, comments count: ${comments.length} for ${postSlug}`);
  
  // Сортируем топ-3 комментария НАПРЯМУЮ (observer-реактивно)
  const sortedComments = comments.length > 0 
    ? [...comments].sort((a, b) => (b.likes || 0) - (a.likes || 0)).slice(0, 3)
    : [];
  
  // Проверяем, лайкнул ли пользователь комментарий
  const isCommentLiked = useCallback((comment: Comment): boolean => {
    return userId ? comment.likedUserIds?.includes(userId) ?? false : false;
  }, [userId]);
  
  // Обработчик лайка комментария
  const handleLike = useCallback((commentId: string) => {
    if (!userId || !isMountedRef.current) return;
    commentStore.toggleLike(commentId, userId);
  }, [userId]);
  
  // Загружаем данные ТОЛЬКО при открытии дропдауна
  const loadCommentsOnOpen = useCallback(async () => {
    if (!isMountedRef.current || hasLoaded || loading || !entity) return;
    
    logger.log(`[CommentPreviewDropdown] Loading comments for ${postSlug}, type: ${entityType}`);
    
    setLoading(true);
    
    try {
      if (entityType === 'post') {
        logger.log(`[CommentPreviewDropdown] Loading comments for post ${postSlug}`);
        await commentStore.loadCommentsBySlug(postSlug, 10, 1, undefined, false);
      } else if (entityType === 'comment') {
        logger.log(`[CommentPreviewDropdown] Loading replies for comment ${postSlug}`);
        await commentStore.loadCommentsBySlug(postSlug, 10, 1, undefined, true);
      }
      
      if (isMountedRef.current) {
        setHasLoaded(true);
        logger.log(`[CommentPreviewDropdown] Successfully loaded data for ${postSlug}`);
      }
    } catch (error) {
      if (isMountedRef.current) {
        logger.error(`[CommentPreviewDropdown] Error loading data:`, error);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [postSlug, hasLoaded, loading, entityType, entity]);
  
  // Обработчик изменения видимости дропдауна
  const handleVisibleChange = useCallback((newVisible: boolean) => {
    if (!isMountedRef.current) return;
    
    logger.log(`[CommentPreviewDropdown] Visibility changed to ${newVisible} for ${postSlug}`);
    setVisible(newVisible);
    
    // Загружаем данные при открытии
    if (newVisible && !hasLoaded && !loading && entity) {
      loadCommentsOnOpen();
    }
  }, [hasLoaded, loading, loadCommentsOnOpen, entity, postSlug]);
  
  // Обработчик клика по комментарию
  const handleCommentClick = useCallback((commentId: string) => {
    if (!isMountedRef.current) return;
    
    const comment = commentStore.getItemById(commentId);
    const commentSlug = comment?.slug;
    
    if (!commentSlug) {
      logger.error(`[CommentPreviewDropdown] Comment ${commentId} has no slug`);
      return;
    }
    
    setVisible(false);
    navigate(`/comment/${commentSlug}`);
  }, [navigate]);
  
  // Обработчик "View all"
  const handleViewAll = useCallback(() => {
    if (!isMountedRef.current) return;
    setVisible(false);
    navigate(entityType === 'post' ? `/post/${postSlug}` : `/comment/${postSlug}`);
  }, [navigate, entityType, postSlug]);
  
  // Не рендерим если нет entity
  if (!entity) {
    logger.log(`[CommentPreviewDropdown] No entity found for ${postSlug}`);
    return null;
  }
  
  // Логируем состояние перед рендерингом
  logger.log(`[CommentPreviewDropdown] Rendering dropdown for ${postSlug}: loading=${loading}, sortedComments=${sortedComments.length}`);
  
  // Содержимое дропдауна
  const dropdownContent = (
    <Card 
      size="small" 
      variant="borderless"
      className="comment-preview-card"
    >
      <div className="comment-preview-header">
        <MessageOutlined className="comment-preview-icon" />
        <Typography.Text type="secondary" className="comment-preview-title">
          {entityType === 'post' ? 'Top comments' : 'Top replies'}
        </Typography.Text>
      </div>
      
      {loading ? (
        <div className="comment-preview-loading">
          <Spin size="small" />
          <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
            Loading...
          </Typography.Text>
        </div>
      ) : sortedComments.length > 0 ? (
        <>
          {sortedComments.map(comment => (
            <CommentPreview 
              key={comment.id} 
              comment={comment} 
              onClick={handleCommentClick}
              onLike={handleLike}
              isLiked={isCommentLiked(comment)}
            />
          ))}
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
              {entityType === 'post' ? 'No comments yet' : 'No replies yet'}
            </Typography.Text>
          }
          className="comment-preview-empty"
        />
      )}
    </Card>
  );

  return (
    <Dropdown 
      open={visible}
      onOpenChange={handleVisibleChange}
      trigger={['click']} 
      popupRender={() => dropdownContent}
      placement="bottomRight"
      arrow
      destroyOnHidden={true}
      overlayStyle={{ width: 'auto' }}
    >
      {children}
    </Dropdown>
  );
});
CommentPreview.displayName = 'CommentPreview';
CommentPreviewDropdown.displayName = 'CommentPreviewDropdown';

export default CommentPreviewDropdown;