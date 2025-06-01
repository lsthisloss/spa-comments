import React, { useState, useEffect, memo, useCallback, useRef } from 'react';
import { Dropdown, Typography, Avatar, Space, Card, Button, Spin, Empty } from 'antd';
import { LikeOutlined, LikeFilled, MessageOutlined } from '@ant-design/icons';
import { Comment } from '../../types/interfaces';
import userStore from '../../services/stores/UserStore';
import { commentStore } from '../../services/stores/CommentStore';
import { getAvatarColor } from '../ui/particles/avatarColor';
import { observer } from 'mobx-react-lite';
import { logger } from '../../utils/Logger';
import { postStore } from '../../services/stores/PostStore';
import { useNavigationHelper } from '../../hooks/useNavigationHelper';

// Simplified comment preview component
const CommentPreview = memo(({ comment, onClick, onLike, isLiked }: {
  comment: Comment;
  onClick: (id: string) => void;
  onLike: (commentId: string) => void;
  isLiked: boolean;
}) => {
  const avatarLetter = (comment.user?.userName?.[0] || comment.userName?.[0] || '?').toUpperCase();
  const avatarUrl = comment.user?.avatarUrl;
  const avatarShape = comment.user?.avatarShape || 'circle';
  
  // Truncate content for preview
  const content = comment.content.length > 60 
    ? `${comment.content.substring(0, 60)}...` 
    : comment.content;
  
  // Event handlers with memoization
  const handleClick = useCallback(() => onClick(comment.id), [comment.id, onClick]);
  
  const handleLikeClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onLike(comment.id);
  }, [comment.id, onLike]);
  
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
        
        {/* Like button */}
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
  const { navigateToEntity } = useNavigationHelper();
  
  // Component lifecycle management
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);
  
  // Reset state when slug changes
  useEffect(() => {
    setHasLoaded(false);
    setLoading(false);
  }, [postSlug]);
  
  // Reactive data retrieval
  const post = postStore.getPostBySlug(postSlug);
  const comment = !post ? commentStore.getCommentBySlug(postSlug) : null;
  
  // Determine entity type and get comments
  const entityType = post ? 'post' : (comment ? 'comment' : null);
  const entity = post || comment;
  const comments = entityType === 'post' && post 
    ? commentStore.getComments(post.id)
    : (entityType === 'comment' && comment ? commentStore.getReplies(comment.id) : []);
  
  // Top comments (sorted by likes)
  const topComments = comments.length > 0 
    ? [...comments].sort((a, b) => (b.likes || 0) - (a.likes || 0)).slice(0, 3)
    : [];
  
  // Check if user liked a comment
  const isCommentLiked = useCallback((comment: Comment): boolean => {
    return userId ? (comment.likedUserIds?.includes(userId) ?? false) : false;
  }, [userId]);
  
  // Toggle like on a comment
  const handleLike = useCallback((commentId: string) => {
    if (!userId || !isMountedRef.current) return;
    commentStore.toggleLike(commentId, userId);
  }, [userId]);
  
  // Load comments when dropdown opens
  const loadCommentsOnOpen = useCallback(async () => {
    if (!isMountedRef.current || hasLoaded || loading || !entity) return;
    
    setLoading(true);
    
    try {
      await commentStore.loadCommentsBySlug(
        postSlug, 
        10, 
        1, 
        undefined, 
        entityType === 'comment'
      );
      
      if (isMountedRef.current) {
        setHasLoaded(true);
      }
    } catch (error) {
      logger.error(`[CommentPreviewDropdown] Error loading data:`, error);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [postSlug, hasLoaded, loading, entityType, entity]);
  
  // Handle dropdown visibility change
  const handleVisibleChange = useCallback((newVisible: boolean) => {
    if (!isMountedRef.current) return;
    
    setVisible(newVisible);
    
    if (newVisible && !hasLoaded && !loading && entity) {
      loadCommentsOnOpen();
    }
  }, [hasLoaded, loading, loadCommentsOnOpen, entity]);
  
  // Handle click on comment to navigate
  const handleCommentClick = useCallback((commentId: string) => {
    if (!isMountedRef.current) return;
    
    const comment = commentStore.getItemById(commentId);
    if (!comment?.slug) return;
    
    setVisible(false);
    navigateToEntity('comment', comment.slug);
  }, [navigateToEntity]);
  
  // Handle "View all" click
  const handleViewAll = useCallback(() => {
    if (!isMountedRef.current) return;
    
    setVisible(false);
    navigateToEntity(entityType as 'post' | 'comment', postSlug);
  }, [navigateToEntity, entityType, postSlug]);
  
  // Don't render if no entity found
  if (!entity) return null;
  
  // Dropdown content
  const dropdownContent = (
    <Card size="small" variant="borderless" className="comment-preview-card">
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
      ) : topComments.length > 0 ? (
        <>
          {topComments.map(comment => (
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

export default CommentPreviewDropdown;