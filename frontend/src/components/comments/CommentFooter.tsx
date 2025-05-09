import { useEffect, useState, useContext } from 'react';
import { Button, Dropdown  } from 'antd';
import { MessageOutlined, HeartFilled, HeartOutlined, DownloadOutlined, UpOutlined, DownOutlined  } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { WebSocketContext } from '../../services/WebSocketContext';
import { setLikedPost, isPostLiked, removeLikedPost } from '../../services/likeStorage';

export default function CommentFooter({
  postId,
  initialLikes = 0,
  repliesCount = 0,
  onShowReplies,
  showReplies,
  loadingReplies,
  fileUrl,
  fileName,
}: {
  postId: string;
  initialLikes?: number;
  repliesCount?: number;
  onShowReplies?: () => void;
  showReplies?: boolean;
  loadingReplies?: boolean;
  fileUrl?: string;
  fileName?: string;
}) {
  const navigate = useNavigate();
  const socket = useContext(WebSocketContext);
  const [liked, setLiked] = useState(isPostLiked(postId));
  const [likes, setLikes] = useState(initialLikes);
  const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;

  const fileMenu = [
    {
      key: 'download',
      label: (
        <a
          href={fileUrl?.startsWith('http') ? fileUrl : `${apiUrl}${fileUrl}`}
          download={fileName || true}
          rel="noopener noreferrer"
        >
          <DownloadOutlined/>
          Download {fileName}
        </a>
      ),
    },
  ];
  
  useEffect(() => {
    setLikes(initialLikes);
  }, [initialLikes]);

  useEffect(() => {
    if (!socket) return undefined;
    const handler = (data: { commentId: string; likes: number }) => {
      if (data.commentId === postId) setLikes(data.likes);
    };
    socket.on('commentLiked', handler);
    return () => {
      socket.off('commentLiked', handler);
    };
  }, [socket, postId]);

  const handleLikeClick = () => {
    if (!socket) return;
    if (!liked) {
      socket.emit('likeComment', { commentId: postId }, (response: { success: boolean; likes: number }) => {
        if (response.success) {
          setLikes(response.likes);
          setLiked(true);
          setLikedPost(postId);
        }
      });
    } else {
      socket.emit('unlikeComment', { commentId: postId }, (response: { success: boolean; likes: number }) => {
        if (response.success) {
          setLikes(response.likes);
          setLiked(false);
          removeLikedPost(postId);
        }
      });
    }
  };

  return (
    <div className="comment-footer">
      <div className="footer-row">
        <Button
          type="text"
          icon={
            liked ? (
              <HeartFilled className="heart-icon liked" />
            ) : (
              <HeartOutlined className="heart-icon" />
            )
          }
          onClick={handleLikeClick}
        >
          {likes}
        </Button>
        <Button
          type="text"
          icon={<MessageOutlined />}
          onClick={() => navigate(`/post/${postId}`)}
        >
          {repliesCount}
        </Button>
        {repliesCount > 0 && onShowReplies && (
        <Button
          type="text"
          icon={showReplies ? <UpOutlined /> : <DownOutlined />}
          style={{ marginLeft: 8, marginRight: 8 }}
          disabled={loadingReplies}
          aria-label={showReplies ? 'Hide replies' : 'Show replies'}
          onClick={onShowReplies}
        />
        )}
        {fileUrl && fileName && (
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
            />
          </Dropdown>
        )}

      </div>

    </div>
  );
}