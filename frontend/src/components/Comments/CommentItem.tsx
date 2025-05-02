import { Tooltip, Button, Card, Typography } from 'antd';
import { LikeOutlined, DislikeOutlined } from '@ant-design/icons';
import '../../styles/Comments/CommentItem.css';

const { Text } = Typography;

interface Props {
  comment: {
    userName: string;
    createdAt: string | number | Date;
    text: string;
  };
  level: number;
  children?: React.ReactNode;
}

export default function CommentItem({ comment, level, children }: Props) {
  return (
    <Card className="comment-item">
      <div className={`comment-header ${level > 0 ? 'nested-header' : ''}`}>
        <div className="comment-avatar">{comment.userName[0]}</div>
        <div className="comment-user-info">
          <Text strong>{comment.userName}</Text>
          <Tooltip title={new Date(comment.createdAt).toLocaleString()}>
            <Text type="secondary" className="comment-date">
              {new Date(comment.createdAt).toLocaleString()}
            </Text>
          </Tooltip>
        </div>
        <div className="comment-actions-right">
          <Tooltip title="Like">
            <Button type="text" icon={<LikeOutlined />} />
          </Tooltip>
          <Tooltip title="Dislike">
            <Button type="text" icon={<DislikeOutlined />} />
          </Tooltip>
        </div>
      </div>

      <Typography.Paragraph className="comment-text">{comment.text}</Typography.Paragraph>

      <div className="nested-comments">{children}</div>
    </Card>
  );
}