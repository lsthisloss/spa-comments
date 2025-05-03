import { Button, Tooltip } from 'antd';
import { MessageOutlined, HeartFilled, HeartOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import '../../styles/Comments/CommentFooter.css';

interface CommentFooterProps {
  postId: string;
}

export default function CommentFooter({ postId }: CommentFooterProps) {
  const navigate = useNavigate();
  const [liked, setLiked] = useState(false);

  const handleLikeClick = () => {
    setLiked(!liked);
  };

  return (
    <div className="comment-footer">
      <Tooltip title="Likes" placement="bottom">
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
          357
        </Button>
      </Tooltip>
      <Tooltip title="Comments" placement="bottom">
        <Button
          type="text"
          icon={<MessageOutlined />}
          onClick={() => navigate(`/post/${postId}`)}
        >
          93
        </Button>
      </Tooltip>
    </div>
  );
}