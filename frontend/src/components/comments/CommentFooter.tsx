import { useEffect, useState, useContext } from 'react';
import { Button } from 'antd';
import { MessageOutlined, HeartFilled, HeartOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { WebSocketContext } from '../../services/WebSocketContext';
import { setLikedPost, isPostLiked, removeLikedPost } from '../../services/likeStorage';

export default function CommentFooter({ postId, initialLikes = 0 }: { postId: string; initialLikes?: number }) {
  const navigate = useNavigate();
  const socket = useContext(WebSocketContext);
  const [liked, setLiked] = useState(isPostLiked(postId));
  const [likes, setLikes] = useState(initialLikes);

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
        Reply
      </Button>
    </div>
  );
}