import { Button } from 'antd';
import { MessageOutlined, HeartFilled, HeartOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import '../../styles/main.scss';

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