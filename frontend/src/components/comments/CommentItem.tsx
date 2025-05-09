import { Tooltip, Card, Typography, Image } from 'antd';
import '../../styles/main.scss';
import CommentFooter from './CommentFooter';
import { getAvatarColor } from '../particles/avatarColor';
import { useRef, useState, useEffect, useContext } from 'react';
import { WebSocketContext } from '../../services/WebSocketContext';
import type { Comment } from '../../types/comment'; 
import { useNavigate } from 'react-router-dom';

const { Text } = Typography;
const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;

interface CommentItemProps {
  comment: Comment & {
    repliesCount?: number;
    level?: number;
    children?: Comment[];
  };
  level: number;
  disableShowMore?: boolean;
}

const CommentItem: React.FC<CommentItemProps> = ({ comment, disableShowMore }) => {
  const avatarLetter = comment.userName.charAt(0).toUpperCase();
  const textRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState<CommentItemProps['comment'][]>(comment.children || []);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const socket = useContext(WebSocketContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (textRef.current) {
      const lineHeight = parseFloat(getComputedStyle(textRef.current).lineHeight || '20');
      const maxHeight = lineHeight * 3;
      setShowButton(textRef.current.scrollHeight > maxHeight + 1);
    }
  }, [comment.text]);

  useEffect(() => {
    if (disableShowMore) {
      setShowButton(false);
      setExpanded(true); 
      return;
    }
  }, [comment.text, disableShowMore]);


  const handleShowReplies = async () => {
    setShowReplies((prev) => !prev);
    if (!showReplies && replies.length === 0 && socket) {
      setLoadingReplies(true);
      socket.emit(
        'fetchNestedComments',
        { parentId: comment.id, limit: 3 },
        (response: { parent: Comment; children: Comment[] }) => {
          setReplies(response.children || []);
          setLoadingReplies(false);
        }
      );
    }
  };
  
  const handleShowAll = () => {
    navigate(`/post/${comment.id}`);
  };
  
  return (
    <Card className="comment-item">
      <div className="comment-layout">
        <div
          className="comment-avatar"
          style={{
            background: getAvatarColor(avatarLetter),
          }}
        >
          {avatarLetter}
        </div>
        <div className="comment-content">
          <div className="comment-user-info">
            <Text strong>{comment.userName}</Text>
            <span className="comment-separator">·</span>
            <Tooltip title={new Date(comment.createdAt).toLocaleString()}>
              <Text type="secondary" className="comment-date">
                {new Date(comment.createdAt).toLocaleString()}
              </Text>
            </Tooltip>
          </div>
          <div
            className={`comment-text${expanded ? ' expanded' : ''}`}
            ref={textRef}
            style={
              !expanded
                ? {
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }
                : {}
            }
            dangerouslySetInnerHTML={{ __html: comment.text.replace(/\n/g, '<br/>') }}
          />
          {showButton && !disableShowMore && (
            !expanded ? (
              <button
                className="show-more-btn"
                onClick={() => setExpanded(true)}
              >
                Show more
              </button>
            ) : (
              <button
                className="show-more-btn"
                onClick={() => setExpanded(false)}
              >
                Show less
              </button>
            )
          )}

          {comment.imageUrl && (
            <div className="comment-image-container">
              <Image
                src={comment.imageUrl.startsWith('http') ? comment.imageUrl : `${apiUrl}${comment.imageUrl}`}
                alt="Comment attachment"
                className="comment-image ant-image-img"

                preview={true}
              />
            </div>
          )}

          <CommentFooter
            postId={comment.id}
            initialLikes={comment.likes || 0}
            repliesCount={comment.repliesCount ?? 0}
            onShowReplies={handleShowReplies}
            showReplies={showReplies}
            loadingReplies={loadingReplies}
            fileUrl={comment.fileUrl}
            fileName={comment.fileName}
          />
          {showReplies && (
          <div className="replies-list">
            {loadingReplies ? (
              <span>Loading...</span>
            ) : (
              <>
                {replies.map((reply) => (
                  <CommentItem
                    key={reply.id}
                    comment={reply}
                    level={(comment.level || 0) + 1}
                    disableShowMore={false}
                  />
                ))}
                {comment.repliesCount && comment.repliesCount > 3 && (
                  <button className="show-all-replies-btn" onClick={handleShowAll}>
                    Show all ({comment.repliesCount})
                  </button>
                )}
              </>
            )}
          </div>
        )}
        </div>
      </div>
    </Card>
  );
};

export default CommentItem;