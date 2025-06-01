import { Image, Tooltip, Card, Typography, Spin } from "antd";
import { getAvatarColor } from "../ui/particles/avatarColor";
import ItemFooter from "./ItemFooter";
import OptimizedText from "../ui/optimization/OptimizedText";
import { useState, useMemo, useCallback } from "react";
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
  onNavigate?: (slug: string) => void;
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
  onNavigate,
  onLikeClick,
  expanded = false,
  onShowMore,
  hideCommentButton,
  onClick,
}: FeedItemProps) => {
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

  const formattedDate = React.useMemo(() => {
    return formatDistanceToNow(new Date(item.createdAt), { addSuffix: true });
  }, [item.createdAt]);

  // Обработчик клика по аватару пользователя
  const handleAvatarClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.user?.id) {
      logger.log(`Avatar clicked for user ${item.user.id}`);
      navigate(`/profile/${item.user.id}`);
    }
  }, [item.user, navigate]);

  // Обработчик клика по имени пользователя
  const handleUsernameClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.user?.id) {
      logger.log(`Username clicked for user ${item.user.id}`);
      navigate(`/profile/${item.user.id}`);
    }
  }, [item.user, navigate]);

  return (
    <Card
      className={`${type}-item fade-in`}
      variant="borderless"
      style={{ cursor: "default" }}
      onClick={onClick} // Оставляем undefined для отключения клика по карточке
    >
      <div className="item-layout" data-id={item.id}>
        {item.user?.avatarUrl ? (
          <div
            className="item-avatar"
            style={{ cursor: "pointer" }}
            onClick={handleAvatarClick} // Добавляем обработчик для аватарки
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
            onClick={handleAvatarClick} // Добавляем обработчик для аватарки
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
              onClick={handleUsernameClick} // Добавляем обработчик для имени пользователя
            >
              {userName}
            </Typography.Text>
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
                placeholder={
                  <div
                    style={{
                      height: item.imageHeight || 300,
                      background: "#f0f0f0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
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