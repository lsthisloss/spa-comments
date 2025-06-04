import { Button, Dropdown } from 'antd';
import { MessageOutlined, HeartFilled, HeartOutlined, DownloadOutlined, EyeOutlined } from '@ant-design/icons';
import type { FeedItemBase } from '../../types/interfaces';
import { analyzeFile } from '../../utils/fileTypeDetector';
import { logger } from "../../utils/Logger";
import { observer } from "mobx-react-lite";
import { useMemo, useCallback } from 'react';
import React from 'react';
import CommentPreviewDropdown from "../comments/CommentPreviewDropdown";
import { useNavigationHelper } from '../../hooks/useNavigationHelper';

interface FeedItemFooterProps<T extends FeedItemBase> {
  item: T & { 
    likedUserIds?: string[]; 
    repliesCount?: number; 
    commentCount?: number; // Add commentCount for posts
    fileUrl?: string; 
    fileName?: string; 
    fileType?: string; 
    postId?: string;
    slug?: string;
  };
  type: 'post' | 'comment';
  onLikeClick?: (e: React.MouseEvent) => void;
  isLiked?: boolean;
  hideCommentButton?: boolean;
}

function FeedItemFooterComponent<T extends FeedItemBase>({
  item,
  type,
  onLikeClick,
  isLiked,
  hideCommentButton = false,
}: FeedItemFooterProps<T>) {
  const { navigateToEntity } = useNavigationHelper();
  const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;

  // File information
  const fileInfo = useMemo(() => 
    analyzeFile(item.fileType, item.fileName), 
    [item.fileType, item.fileName]
  );

  const shouldShowDownload = useMemo(() => 
    item.fileUrl && item.fileName && !fileInfo.isImage,
    [item.fileUrl, item.fileName, fileInfo.isImage]
  );

  // Определяем правильное количество комментариев/ответов
  // Extract commentCount for posts to avoid complex expressions and 'any'
  const postCommentCount = (item as { commentCount?: number }).commentCount;

// Обновляем логику получения commentCount

const commentCount = useMemo(() => {
  if (type === 'post') {
    // For posts, use commentCount (which is now properly set from server's repliesCount)
    const count = postCommentCount || 0;
    //logger.log(`[ItemFooter] Post ${item.id} commentCount: ${count}`);
    return count;
  } else {
    // For comments, use repliesCount 
    const count = item.repliesCount || 0;
    //logger.log(`[ItemFooter] Comment ${item.id} repliesCount: ${count}`);
    return count;
  }
}, [type, postCommentCount, item.repliesCount]);


  // Navigation handler
  const handleNavigate = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    logger.log(`[ItemFooter] Button clicked for ${type} ${item.id}`);
    
    const identifier = item.slug;
    logger.log(`[ItemFooter] Using identifier for navigation: ${identifier}`);
    
    // Use the navigation helper to handle all navigation scenarios
    navigateToEntity(type, identifier);
  }, [type, item.id, item.slug, navigateToEntity]);

  // File download menu items
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

  return (
    <div className="item-footer">
      <div className="footer-row">
        {/* Like button */}
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
        
        {/* Comment/Reply button */}
        {!hideCommentButton && (
          <Button
            type="text"
            icon={<MessageOutlined />}
            onClick={handleNavigate}
            style={{ cursor: 'pointer' }}
          >
            {commentCount > 0 && commentCount}
          </Button>
        )}
        
        {/* Comment preview dropdown */}
        {commentCount > 0 && (
          <CommentPreviewDropdown postSlug={item.slug || ''}>
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
        
        {/* File download dropdown */}
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