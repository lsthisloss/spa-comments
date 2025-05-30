import { Button, Dropdown } from 'antd';
import { MessageOutlined, HeartFilled, HeartOutlined, DownloadOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { FeedItemBase } from '../../types/interfaces';
import { analyzeFile } from '../../utils/fileTypeDetector';
import { logger } from "../../utils/Logger";
import { observer } from "mobx-react-lite";
import { commentStore } from '../../services/stores/CommentStore';
import { useEffect, useMemo } from 'react';
import { reaction } from 'mobx';
import React from 'react';
import CommentPreviewDropdown from "../comments/CommentPreviewDropdown";
import { navigationStore } from '../../services/stores/NavigationStore';


interface FeedItemFooterProps<T extends FeedItemBase> {
  item: T & { likedUserIds?: string[]; repliesCount?: number; fileUrl?: string; fileName?: string; fileType?: string; postId?: string; };
  type: 'post' | 'comment';
  onNavigate?: (id: string) => void;
  onLikeClick?: (e: React.MouseEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
  isLiked?: boolean;
  hideCommentButton?: boolean;
}

function FeedItemFooterComponent<T extends FeedItemBase>({
  item,
  type,
  onNavigate,
  onLikeClick,
  isLiked,
  onClick,
  hideCommentButton = false,
}: FeedItemFooterProps<T>) {
  const navigate = useNavigate();
  const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;

  // Мемоизированные вычисления
  const fileInfo = useMemo(() => 
    analyzeFile(item.fileType, item.fileName), 
    [item.fileType, item.fileName]
  );

  const shouldShowDownload = useMemo(() => 
    item.fileUrl && item.fileName && !fileInfo.isImage,
    [item.fileUrl, item.fileName, fileInfo.isImage]
  );



const handleNavigate = (e: React.MouseEvent) => {
  e.stopPropagation();
  
  logger.log(`Button clicked for ${type} ${item.id}`);
  
  if (onClick) {
    onClick(e);
    return;
  }
  
  try {
    // Получаем текущее состояние для сохранения в истории
    const currentState = navigationStore.getSerializedState();
    
    // Создаем новое состояние с сохранением предыдущего
    const navigationState = navigationStore.saveNavigationState(type, item.id, currentState);
    
    if (onNavigate) {
      logger.log(`ItemFooter: calling onNavigate for ${type} ${item.id}`);
      onNavigate(item.id);
    } else if (type === "post") {
      logger.log(`ItemFooter: Direct navigate to post ${item.id}`);
      navigate(`/post/${item.id}`, { state: navigationState });
    } else if (type === "comment") {
      logger.log(`ItemFooter: Direct navigate to comment ${item.id}`);
      navigate(`/comment/${item.id}`, { state: navigationState });
    }
  } catch (error) {
    // Обработка ошибок сериализации
    logger.error(`Navigation error for ${type} ${item.id}:`, error);
    
    // Простая навигация без состояния в случае ошибки
    if (type === "post") {
      navigate(`/post/${item.id}`);
    } else if (type === "comment") {
      navigate(`/comment/${item.id}`);
    }
  }
};

  const fileMenu = useMemo(() => shouldShowDownload ? [
    {
      key: 'download',
      label: (
        <a
          href={item.fileUrl && item.fileUrl.startsWith('http') ? item.fileUrl : `${apiUrl}${item.fileUrl ?? ''}`}
          download={item.fileName || true}
          rel="noopener noreferrer"
        >
          <DownloadOutlined style={{ paddingRight: 8 }} />
          Download {item.fileName}
        </a>
      ),
    },
  ] : [], [shouldShowDownload, item.fileUrl, item.fileName, apiUrl]);

  // Отслеживаем изменения для отладки
useEffect(() => {
  let isComponentMounted = true;
  
  const unsubscribe = reaction(
    () => ({
      replies: commentStore.getReplies(item.id),
      shown: commentStore.isRepliesShown(item.id),
      loading: commentStore.isLoadingReplies(item.id)
    }),
    (data) => {
      if (isComponentMounted) {
        logger.log(`[ItemFooter] Replies data changed for ${type} ${item.id}:`, data);
      }
    }
  );

  return () => {
    isComponentMounted = false;
    unsubscribe();
  };
}, [item.id, type]);

  return (
    <div className="item-footer">
      <div className="footer-row">
        <Button
          type="text"
          icon={isLiked ? <HeartFilled className="heart-icon liked" /> : <HeartOutlined className="heart-icon" />}
          onClick={(e) => {
            e.stopPropagation();
            if (onLikeClick) {
              onLikeClick(e);
            }
          }}
        >
          {item.likedUserIds ? item.likedUserIds.length : 0}
        </Button>
        
        {!hideCommentButton && (
            <Button
              type="text"
              icon={<MessageOutlined />}
              onClick={handleNavigate}
              style={{ 
                cursor: 'pointer',
              }}
              onMouseDown={() => logger.log(`Button mouse down on ${type} ${item.id}`)}
            >
              {(item.repliesCount ?? 0) > 0 && item.repliesCount}
            </Button>
          )}
        
        {(item.repliesCount ?? 0) > 0 && (
          <CommentPreviewDropdown 
            postId={item.id}
          >
            <Button
              type="text"
              icon={<EyeOutlined />}
              className="preview-icon-button"
              style={{ marginLeft: 0 }}
              aria-label="Quick view replies"
              onClick={(e) => {
                e.stopPropagation();
              }}
            />
          </CommentPreviewDropdown>
        )}
        
        {fileMenu.length > 0 && (
          <Dropdown 
            menu={{ items: fileMenu }} 
            placement="bottom" 
            trigger={['click']} 
            arrow
          >
            <Button 
              type="text" 
              icon={<DownloadOutlined />} 
              style={{ marginLeft: 8 }}
              title={`Download ${item.fileName}`}
            />
          </Dropdown>
        )}
      </div>
    </div>
  );
}

const ItemFooter = React.memo(observer(FeedItemFooterComponent));
export default ItemFooter;