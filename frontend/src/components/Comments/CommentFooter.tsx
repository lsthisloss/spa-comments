import { Button, Tooltip } from 'antd';
import { MessageOutlined, RetweetOutlined, HeartOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import '../../styles/Comments/CommentFooter.css';

interface CommentFooterProps {
  postId: string;
}

export default function CommentFooter({ postId }: CommentFooterProps) {
  const navigate = useNavigate();

  return (
    <div className="comment-footer">
      <Tooltip title="Likes">
        <Button type="text" icon={<HeartOutlined />}>
          357
        </Button>
      </Tooltip>
      <Tooltip title="Comments">
        <Button
          type="text"
          icon={<MessageOutlined />}
          onClick={() => navigate(`/post/${postId}`)}
        >
          93
        </Button>
      </Tooltip>
      <Tooltip title="Retweets">
        <Button type="text" icon={<RetweetOutlined />} className="disabled">
          18
        </Button>
      </Tooltip>
    </div>
  );
}