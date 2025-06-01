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
  postId: string;
}

const CommentPreviewDropdown = observer(({ children, postId }: CommentPreviewDropdownProps) => {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const isMountedRef = useRef(true);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const userId = userStore.user?.id;
  const navigate = useNavigate();
  
  // Cleanup при unmount
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    };
  }, []);
  
  // Пробуем получить данные и как посты, и как комментарии
  const postComments = commentStore.getComments(postId);
  const commentReplies = commentStore.getReplies(postId);
  
  // Определяем тип по наличию данных
  const isPost = postComments.length > 0 || commentReplies.length === 0;
  const comments = isPost ? postComments : commentReplies;
  
  const isLoading = commentStore.isLoadingReplies(postId);
  
  // Сортируем и берем топ-3 с проверкой наличия данных
  const sortedComments = React.useMemo(() => {
    if (!comments || comments.length === 0) return [];
    return [...comments]
      .sort((a, b) => (b.likes || 0) - (a.likes || 0))
      .slice(0, 3);
  }, [comments]);
  
  // Проверяем, лайкнул ли пользователь комментарий
  const isCommentLiked = useCallback((comment: Comment): boolean => {
    return userId ? comment.likedUserIds?.includes(userId) ?? false : false;
  }, [userId]);
  
  // Обработчик лайка комментария
  const handleLike = useCallback((commentId: string) => {
    if (!userId || !isMountedRef.current) return;
    commentStore.toggleLike(commentId, userId);
  }, [userId]);
  
  // Безопасная установка состояния loading
  const setLoadingSafe = useCallback((newLoading: boolean) => {
    if (isMountedRef.current) {
      setLoading(newLoading);
    }
  }, []);
  
  // Оптимизированный loadCommentsForPost с проверкой mounted состояния
  const loadCommentsForPost = useCallback((targetPostId: string) => {
    if (!isMountedRef.current) return;
    
    setLoadingSafe(true);
    
    logger.log(`[CommentPreviewDropdown] Loading ${isPost ? 'comments' : 'replies'} for ${targetPostId}`);
    
    const loadPromise = commentStore.loadComments(targetPostId, 10, 1, undefined, !isPost);
    
    loadPromise
      .catch(error => {
        if (isMountedRef.current) {
          logger.error(`[CommentPreviewDropdown] Error loading data: ${error}`);
        }
      })
      .finally(() => {
        // Используем timeout для безопасного обновления состояния
        loadingTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            setLoadingSafe(false);
          }
          loadingTimeoutRef.current = null;
        }, 100);
      });
  }, [isPost, setLoadingSafe]);
  
  // Обработчик видимости дропдауна
  const handleVisibleChange = useCallback((newVisible: boolean) => {
    if (!isMountedRef.current) return;
    setVisible(newVisible);
  }, []);
  
  // Загрузка данных при открытии дропдауна
  useEffect(() => {
    if (visible && postId && comments.length === 0 && !isLoading && !loading && isMountedRef.current) {
      loadCommentsForPost(postId);
    }
  }, [visible, postId, comments.length, isLoading, loading, loadCommentsForPost]);
  
  // Обработчик клика по комментарию
  const handleCommentClick = useCallback((commentId: string) => {
    if (!isMountedRef.current) return;
    setVisible(false);
    navigate(`/comment/${commentId}`);
  }, [navigate]);
  
  // Обработчик "View all"
  const handleViewAll = useCallback(() => {
    if (!isMountedRef.current) return;
    setVisible(false);
    navigate(isPost ? `/post/${postId}` : `/comment/${postId}`);
  }, [navigate, isPost, postId]);
  
  // Не рендерим если компонент unmounted
  if (!isMountedRef.current) {
    return null;
  }
  
  // Содержимое дропдауна
  const dropdownContent = React.useMemo(() => (
    <Card 
      size="small" 
      variant="borderless"
      className="comment-preview-card"
    >
      <div className="comment-preview-header">
        <MessageOutlined className="comment-preview-icon" />
        <Typography.Text type="secondary" className="comment-preview-title">
          {isPost ? 'Top comments' : 'Top replies'}
        </Typography.Text>
      </div>
      
      {(loading || isLoading) ? (
        <div className="comment-preview-loading">
          <Spin size="small" />
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
              {isPost ? 'View all comments' : 'View all replies'}
            </Button>
          </div>
        </>
      ) : (
        <Empty 
          image={Empty.PRESENTED_IMAGE_SIMPLE} 
          description={
            <Typography.Text className="comment-preview-text">
              {isPost ? 'No comments yet' : 'No replies yet'}
            </Typography.Text>
          }
          className="comment-preview-empty"
        />
      )}
    </Card>
  ), [loading, isLoading, sortedComments, isPost, handleCommentClick, handleLike, isCommentLiked, handleViewAll]);

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