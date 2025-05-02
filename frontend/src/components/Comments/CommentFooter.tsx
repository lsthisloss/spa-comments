import { Button, Tooltip } from 'antd';
import { MessageOutlined, RetweetOutlined, HeartOutlined, BarChartOutlined, BookOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import '../../styles/Comments/CommentFooter.css';

interface CommentFooterProps {
  postId: string;
}

export default function CommentFooter({ postId }: CommentFooterProps) {
  const navigate = useNavigate();

  return (
    <div className="comment-footer">
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
        <Button type="text" icon={<RetweetOutlined />}>
          18
        </Button>
      </Tooltip>
      <Tooltip title="Likes">
        <Button type="text" icon={<HeartOutlined />}>
          357
        </Button>
      </Tooltip>
      <Tooltip title="Views">
        <Button type="text" icon={<BarChartOutlined />}>
          42K
        </Button>
      </Tooltip>
      <Tooltip title="Save">
        <Button type="text" icon={<BookOutlined />}>
        </Button>
      </Tooltip>
    </div>
  );
}