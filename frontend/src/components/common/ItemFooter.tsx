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

/*
  Компонент для отображения футера элемента ленты (пост или комментарий).
  Содержит кнопки лайка, комментариев и скачивания файлов.
  Используется в ленте постов и комментариев.
*/
interface FeedItemFooterProps<T extends FeedItemBase> {
  item: T & {
    likedUserIds?: string[];
    repliesCount?: number;
    commentCount?: number;
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

  // File информация
  const fileInfo = useMemo(() =>
    analyzeFile(item.fileType, item.fileName),
    [item.fileType, item.fileName]
  );

  // Проверяем, нужно ли показывать кнопку скачивания
  const shouldShowDownload = useMemo(() =>
    item.fileUrl && item.fileName && !fileInfo.isImage,
    [item.fileUrl, item.fileName, fileInfo.isImage]
  );

  const handleFileDownload = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (!item.fileUrl || !item.fileName) {
      logger.error('[ItemFooter] No file URL or filename for download');
      return;
    }

    try {
      const fileUrl = item.fileUrl.startsWith('http')
        ? item.fileUrl
        : `${apiUrl}${item.fileUrl}`;

      logger.log(`[ItemFooter] Downloading file: ${item.fileName} from ${fileUrl}`);

      // Fetch файл
      const response = await fetch(fileUrl);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Получаем blob
      const blob = await response.blob();

      // Создаем временную ссылку для скачивания
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = item.fileName;

      // Добавляем в DOM, кликаем и удаляем
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Очищаем URL объект
      window.URL.revokeObjectURL(downloadUrl);

      logger.log(`[ItemFooter] File downloaded successfully: ${item.fileName}`);

    } catch (error) {
      logger.error('[ItemFooter] Download failed:', error);

      // Fallback - пробуем стандартное скачивание
      const link = document.createElement('a');
      link.href = item.fileUrl.startsWith('http') ? item.fileUrl : `${apiUrl}${item.fileUrl}`;
      link.download = item.fileName;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, [item.fileUrl, item.fileName, apiUrl]);

  // Комментарии и ответы
  // Используем commentCount для постов и repliesCount для комментариев
  const postCommentCount = (item as { commentCount?: number }).commentCount;
  const commentCount = useMemo(() => {
    if (type === 'post') {
      // Для постов используем commentCount
      // Если commentCount не определен, используем 0
      const count = postCommentCount || 0;
      return count;
    } else {
      // Для комментариев используем repliesCount
      const count = item.repliesCount || 0;
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
        <div
          onClick={handleFileDownload}
          style={{
            cursor: 'pointer',
            padding: '4px 0',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <DownloadOutlined />
          Download {item.fileName}
        </div>
      ),
    },
  ] : [], [shouldShowDownload, item.fileName, handleFileDownload]);


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
              onClick={(e) => {
                e.stopPropagation();
              }}
            />
          </Dropdown>
        )}
      </div>
    </div>
  );
}

const ItemFooter = observer(FeedItemFooterComponent);
export default ItemFooter;