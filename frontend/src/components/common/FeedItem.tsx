import { Image, Tooltip, Card, Typography, Spin } from "antd";
import { getAvatarColor } from "../ui/particles/avatarColor";
import ItemFooter from "./ItemFooter";
import OptimizedText from "../ui/optimization/OptimizedText";
import { useState, useEffect, useMemo, useCallback } from "react";
import React from "react";
import { observer } from "mobx-react-lite";
import { commentStore } from "../../services/stores/CommentStore";
import userStore from "../../services/stores/UserStore";
import { Comment as CommentType, Post } from "../../types/interfaces";
import { logger } from "../../utils/Logger";
import { formatDistanceToNow } from "date-fns";
import { postStore } from "../../services/stores/PostStore";
import { useNavigate } from "react-router-dom";

const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;

type FeedItemType = CommentType | Post;

interface FeedItemProps {
  item: FeedItemType;
  type: "post" | "comment";
  disableShowMore?: boolean;
  onClick?: () => void;
  onNavigate?: (id: string) => void;
  onLikeClick?: () => void;
  onShowMore?: () => void;
  expanded?: boolean;
  hideCommentButton?: boolean;
}

const MemoizedTooltip = React.memo(
  ({ title, children }: { title: string; children: React.ReactNode }) => (
    <Tooltip title={title}>{children}</Tooltip>
  )
);

const MemoizedItemContent = React.memo(function ItemContent({
  item,
  type,
  userName,
  formattedDate,
  localExpanded,
  imageUrl,
  disableShowMore,
  handleTextToggle,
  handleImageLoad,
  onNavigate,
  handleLikeClick,
  onClick,
  isLiked,
  hideCommentButton = false,
}: {
  item: FeedItemType;
  type: "post" | "comment";
  userName: string;
  formattedDate: string;
  localExpanded: boolean;
  imageUrl: string | null;
  disableShowMore?: boolean;
  handleTextToggle: () => void;
  handleImageLoad: () => void;
  onNavigate?: (id: string) => void;
  handleLikeClick: () => void;
  onClick?: () => void;
  isLiked?: boolean;
  hideCommentButton?: boolean;
}) {
  const navigate = useNavigate();

  const handleUserNameClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    let userSlug: string | undefined;
    let userId: string | undefined;
    
    // Сначала пробуем получить из item.user
    if (item.user?.slug) {
      userSlug = item.user.slug;
      userId = item.user.id;
    } 
    // Если нет item.user, но есть userId в самом item, пробуем найти в userStore
    else if (item.userId) {
      const foundUser = userStore.getCachedUser(item.userId);
      if (foundUser) {
        userSlug = foundUser.slug;
        userId = foundUser.id;
      } else {
        // Если пользователь не найден в кэше, но это может быть текущий пользователь
        if (userStore.user && item.userId === userStore.user.id) {
          userSlug = userStore.user.slug;
          userId = userStore.user.id;
        }
      }
    }
    // Если это собственный пост (userName совпадает с текущим пользователем)
    else if (userStore.user && (
      item.userName === userStore.user.userName || 
      userName === userStore.user.userName
    )) {
      userSlug = userStore.user.slug;
      userId = userStore.user.id;
    }
    
    if (userSlug && userId) {
      logger.log(`Navigating to profile: ${userSlug} (${userId})`);
      
      // Сохраняем позицию скролла
      const scrollPosition = window.scrollY;
      
      // Переходим в профиль с сохранением состояния лент
      navigate(`/profile/${userSlug}`, {
        state: {
          scrollPosition: scrollPosition,
          fromPost: type === 'post' ? true : false,
          fromComment: type === 'comment' ? true : false,
          postId: type === 'comment' ? (item as CommentType).postId : item.id,
          commentId: type === 'comment' ? item.id : undefined,
          preserveFeeds: true // Флаг для сохранения состояния лент
        }
      });
    } else {
      logger.warn('Could not find author data in item:', {
        itemId: item.id,
        itemUserId: item.userId,
        itemUserName: item.userName,
        itemUser: item.user,
        currentUser: userStore.user?.userName
      });
      
      // фолбек: если это собственный пост, переходим на /profile
      if (userStore.user && (
        item.userName === userStore.user.userName || 
        userName === userStore.user.userName
      )) {
        logger.log('Navigating to own profile as fallback');
        navigate('/profile', {
          state: {
            scrollPosition: window.scrollY,
            fromPost: type === 'post' ? true : false,
            fromComment: type === 'comment' ? true : false,
            preserveFeeds: true
          }
        });
      }
    }
  };
  
  return (
    <div className="item-content">
      <div className="item-user-info">
        <Typography.Text 
          strong 
          className="clickable-username"
          onClick={handleUserNameClick}
          style={{ 
            cursor: 'pointer', 
            transition: 'color 0.2s ease',
          }}
        >
          {userName}
        </Typography.Text>
        <span className="item-separator">·</span>
        <MemoizedTooltip title={new Date(item.createdAt).toLocaleString()}>
          <span className="item-date">
            {formattedDate}
          </span>
        </MemoizedTooltip>
      </div>

      {!disableShowMore ? (
        <OptimizedText
          content={item.content}
          maxLength={250}
          expanded={localExpanded}
          onToggle={handleTextToggle}
          className="item-text"
        />
      ) : (
        <div
          className="item-text expanded"
          style={{
            contain: "layout style",
            wordBreak: "break-word",
            overflowWrap: "break-word",
          }}
          dangerouslySetInnerHTML={{ __html: item.content.replace(/\n/g, "<br/>") }}
        />
      )}

      {imageUrl && (
        <div className="item-image-container" onClick={(e) => e.stopPropagation()}>
          <Image
            src={imageUrl}
            alt={`Image attached to post ${item.id}`}
            placeholder={
              <div style={{ 
                height: item.imageHeight || 300,
                background: '#f0f0f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Spin />
              </div>
            }
            loading="lazy"
            onLoad={handleImageLoad}
            preview={true} 
          />
        </div>
      )}

      <ItemFooter
        item={item}
        type={type}
        onNavigate={onNavigate}
        onLikeClick={(e) => {
          e.stopPropagation();
          handleLikeClick();
        }}
        onClick={onClick ? (e) => {
          e.stopPropagation();
          onClick();
        } : undefined}
        isLiked={isLiked}
        hideCommentButton={hideCommentButton}
      />
    </div>
  );
});

function FeedItemComponent(props: FeedItemProps) {
  const {
    item,
    type,
    disableShowMore,
    onNavigate,
    onLikeClick,
    expanded = false,
    onShowMore,
  } = props;

  const navigate = useNavigate();
  const [localExpanded, setLocalExpanded] = useState(expanded);
  const [, setImageLoaded] = useState(false);

  const userName = useMemo(() => {
    if (item.user && item.user.userName) return item.user.userName;
    if (item.userName) return item.userName;
    return "Anonymous";
  }, [item.user, item.userName]);

  const avatarLetter = useMemo(
    () => (userName.charAt(0) || "?").toUpperCase(),
    [userName]
  );

  const userId = userStore.user?.id;
  const isLiked = userId ? item.likedUserIds?.includes(userId) : false;

  const imageUrl = useMemo(() => {
    if (!item.imageUrl) return null;
    return item.imageUrl.startsWith("http") ? item.imageUrl : `${apiUrl}${item.imageUrl}`;
  }, [item.imageUrl]);

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
    if (onShowMore) {
      setTimeout(() => {
        onShowMore();
      }, 50);
    }
  }, [onShowMore]);

  const handleLikeClick = useCallback(() => {
    if (onLikeClick) {
      onLikeClick();
      return;
    }

    const currentUserId = userStore.user?.id;
    
    if (!currentUserId) {
      logger.warn("User not logged in");
      return;
    }

    if (type === "post") {
      logger.log(`Liking post ${item.id} as user ${currentUserId}`);
      postStore.toggleLike(item.id, currentUserId);
    } else if (type === "comment") {
      logger.log(`Liking comment ${item.id} as user ${currentUserId}`);
      commentStore.toggleLike(item.id, currentUserId);
    }
  }, [onLikeClick, type, item.id]);

  const handleTextToggle = useCallback(() => {
    const newExpandedState = !localExpanded;
    setLocalExpanded(newExpandedState);

    if (onShowMore) {
      onShowMore();
    }
  }, [localExpanded, onShowMore]);

  const handleProfileNavigation = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    
    let userSlug: string | undefined;
    let userId: string | undefined;
    
    // Пробуем получить данные пользователя из разных источников
    if (item.user?.slug) {
      userSlug = item.user.slug;
      userId = item.user.id;
    } 
    else if (item.userId) {
      const foundUser = userStore.getCachedUser(item.userId);
      if (foundUser) {
        userSlug = foundUser.slug;
        userId = foundUser.id;
      } else if (userStore.user && item.userId === userStore.user.id) {
        userSlug = userStore.user.slug;
        userId = userStore.user.id;
      }
    }
    else if (userStore.user && (
      item.userName === userStore.user.userName || 
      userName === userStore.user.userName
    )) {
      userSlug = userStore.user.slug;
      userId = userStore.user.id;
    }
    
    if (userSlug && userId) {
      navigate(`/profile/${userSlug}`, {
        state: {
          scrollPosition: window.scrollY,
          fromPost: type === 'post',
          fromComment: type === 'comment',
          postId: type === 'comment' ? (item as CommentType).postId : item.id,
          commentId: type === 'comment' ? item.id : undefined,
          preserveFeeds: true
        }
      });
    } else if (userStore.user && (
      item.userName === userStore.user.userName || 
      userName === userStore.user.userName
    )) {
      // Fallback для собственного профиля
      navigate('/profile', {
        state: {
          scrollPosition: window.scrollY,
          fromPost: type === 'post',
          fromComment: type === 'comment',
          preserveFeeds: true
        }
      });
    }
  }, [item, type, userName, navigate]);
  
  // Обработчик клика по всему элементу - только для внешнего onClick, без навигации
  const { onClick } = props;

  const handleItemClick = useCallback(() => {
    if (onClick) {
      onClick();
    }
  }, [onClick]);

  // Синхронизация локального состояния с пропсами
  useEffect(() => {
    setLocalExpanded(expanded);
  }, [expanded]);

  useEffect(() => {
    if (disableShowMore) {
      setLocalExpanded(true);
    }
  }, [disableShowMore]);

  const formattedDate = React.useMemo(() => {
    return formatDistanceToNow(new Date(item.createdAt), { addSuffix: true });
  }, [item.createdAt]);

  return (
    <Card 
      className={`${type}-item fade-in`} 
      variant="borderless"
      {...(props.onClick ? { onClick: handleItemClick } : {})}
      style={{ cursor: 'default' }}
    >
      <div className="item-layout" data-id={item.id}>
        {item.user?.avatarUrl ? (
          <div 
            className="item-avatar" 
            onClick={handleProfileNavigation}
            style={{ cursor: 'pointer' }}
          >
            <img 
              src={item.user.avatarUrl} 
              alt={`${userName}'s avatar`}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: item.user.avatarShape === 'square' ? '4px' : '50%'
              }}
            />
          </div>
        ) : (
          <div
            className="item-avatar"
            style={{
              background: getAvatarColor(avatarLetter),
              borderRadius: item.user?.avatarShape === 'square' ? '4px' : '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
            onClick={handleProfileNavigation}
          >
            {avatarLetter}
          </div>
        )}
        <MemoizedItemContent
          item={item}
          type={type}
          userName={userName}
          formattedDate={formattedDate}
          localExpanded={localExpanded}
          imageUrl={imageUrl}
          disableShowMore={disableShowMore}
          handleTextToggle={handleTextToggle}
          handleImageLoad={handleImageLoad}
          onNavigate={onNavigate}
          handleLikeClick={handleLikeClick}
          onClick={props.onClick}
          isLiked={isLiked}
          hideCommentButton={props.hideCommentButton}
        />
      </div>
    </Card>
  );
}

const FeedItem = observer(FeedItemComponent);
export default FeedItem;