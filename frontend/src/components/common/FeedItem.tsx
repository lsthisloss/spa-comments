import { Image, Tooltip, Card, Typography } from "antd";
import { getAvatarColor } from "../ui/particles/avatarColor";
import ItemFooter from "./ItemFooter";
import OptimizedText from "../ui/optimization/OptimizedText";
import AdminBadge from "../ui/particles/AdminBadge";
import { useState, useMemo, useCallback } from "react";
import React from "react";
import { observer } from "mobx-react-lite";
import { Comment as CommentType, Post } from "../../types/interfaces";
import { logger } from "../../utils/Logger";
import { formatDistanceToNow } from "date-fns";
import { useUserStore, usePostStore, useCommentStore } from '../../hooks/useStore';
import { useNavigationHelper } from '../../hooks/useNavigationHelper';
const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;

type FeedItemType = CommentType | Post;

interface FeedItemProps {
  item: FeedItemType;
  type: "post" | "comment";
  disableShowMore?: boolean;
  onLikeClick?: () => void;
  onShowMore?: () => void;
  expanded?: boolean;
  hideCommentButton?: boolean;
  onClick?: () => void;
}

const FeedItemComponent = ({
  item,
  type,
  disableShowMore,
  onLikeClick,
  expanded = false,
  onShowMore,
  hideCommentButton,
  onClick,
}: FeedItemProps) => {
  const userStore = useUserStore();
  const postStore = usePostStore();
  const commentStore = useCommentStore();
  const [localExpanded, setLocalExpanded] = useState(expanded);
  const [, setImageLoaded] = useState(false);

  const userName = useMemo(() => {
    if (item.user && item.user.userName) return item.user.userName;
    if (item.userName) return item.userName;
    return "Anonymous";
  }, [item.user, item.userName]);

  const userRole = useMemo(() => {
    return item.user?.role || 'user';
  }, [item.user?.role]);

  const avatarLetter = useMemo(
    () => (userName.charAt(0) || "?").toUpperCase(),
    [userName]
  );

  const userId = userStore.user?.id;
  const isLiked = userId ? item.likedUserIds?.includes(userId) : false;

  const imageUrl = useMemo(() => {
  if (!item.imageUrl) return null;
  
  const fullUrl = item.imageUrl.startsWith("http") 
    ? item.imageUrl 
    : `${apiUrl}${item.imageUrl}`;
    
  return fullUrl;
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
  }, [onLikeClick, type, item.id, userStore.user, postStore, commentStore]);

  const handleTextToggle = useCallback(() => {
    const newExpandedState = !localExpanded;
    setLocalExpanded(newExpandedState);

    if (onShowMore) {
      onShowMore();
    }
  }, [localExpanded, onShowMore]);

  const formattedDate = React.useMemo(() => {
    return formatDistanceToNow(new Date(item.createdAt), { addSuffix: true });
  }, [item.createdAt]);

  const navigationHelper = useNavigationHelper();

// Update the handleUsernameClick function
const handleUsernameClick = useCallback((e: React.MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  
  const userSlug = item.user?.userName || item.userName;
  if (userSlug) {
    logger.log(`[FeedItem] Username clicked for user ${userSlug} (ID: ${item.userId}), using navigation helper`);
    navigationHelper.navigateToProfile(userSlug);
  } else {
    logger.warn(`[FeedItem] No username available for user ${item.userId}`);
  }
}, [item.user?.userName, item.userName, item.userId, navigationHelper]);

// Also update handleAvatarClick to use slug
const handleAvatarClick = useCallback((e: React.MouseEvent) => {
  e.stopPropagation();
  if (item.user?.userName || item.userName) {
    const userSlug = item.user?.userName || item.userName;
    logger.log(`[FeedItem] Avatar clicked for user ${userSlug} (ID: ${item.user?.id})`);
    navigationHelper.navigateToProfile(userSlug);
  }
}, [item.user?.userName, item.userName, item.user?.id, navigationHelper]);

  return (
    <Card
      className={`${type}-item fade-in`}
      variant="borderless"
      style={{ cursor: "default" }}
      onClick={onClick}
    >
      <div className="item-layout" data-id={item.id}>
        {item.user?.avatarUrl ? (
          <div
            className="item-avatar"
            style={{ cursor: "pointer" }}
            onClick={handleAvatarClick}
          >
            <img
              src={item.user.avatarUrl}
              alt={`${userName}'s avatar`}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                borderRadius: item.user.avatarShape === "square" ? "4px" : "50%",
              }}
            />
          </div>
        ) : (
          <div
            className="item-avatar"
            style={{
              background: getAvatarColor(avatarLetter),
              borderRadius: item.user?.avatarShape === "square" ? "4px" : "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
            onClick={handleAvatarClick}
          >
            {avatarLetter}
          </div>
        )}
        <div className="item-content">
          <div className="item-user-info">
              <Typography.Text
                strong
                className="clickable-username"
                style={{
                  cursor: "pointer",
                  transition: "color 0.2s ease",
                }}
                onClick={handleUsernameClick}
              >
                {userName}
              </Typography.Text>
              <AdminBadge role={userRole} />
            <span className="item-separator">·</span>
            <Tooltip title={new Date(item.createdAt).toLocaleString()}>
              <span className="item-date">{formattedDate}</span>
            </Tooltip>
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
              dangerouslySetInnerHTML={{
                __html: item.content.replace(/\n/g, "<br/>"),
              }}
            />
          )}

          {imageUrl && (
            <div className="item-image-container">
              <Image
                src={imageUrl}
                alt={`Image attached to post ${item.id}`}
                loading="lazy"
                onLoad={handleImageLoad}
                onError={(e) => { //
                  console.error('Image failed to load:', imageUrl, e);
                  logger.error(`[FeedItem] Image failed to load: ${imageUrl}`);
                }}
                preview={true}
                style={{
                  maxHeight: '400px', //
                  width: '100%',
                  objectFit: 'cover',
                }}
              />
            </div>
          )}
          <ItemFooter
            item={item}
            type={type}
            onLikeClick={(e) => {
              e.stopPropagation();
              handleLikeClick();
            }}
            isLiked={isLiked}
            hideCommentButton={hideCommentButton}
          />
        </div>
      </div>
    </Card>
  );
};

const FeedItem = observer(FeedItemComponent);
export default FeedItem;