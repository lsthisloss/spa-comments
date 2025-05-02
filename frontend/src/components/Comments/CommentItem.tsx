import { Tooltip, Button, Card, Typography, Dropdown, Menu } from 'antd';
import { MoreOutlined } from '@ant-design/icons';
import '../../styles/Comments/CommentItem.css';
import CommentFooter from './CommentFooter';

const { Text } = Typography;

interface CommentItemProps {
  comment: {
    id: string;
    userName: string;
    text: string;
    createdAt: Date;
  };
  level: number;
}

export default function CommentItem({ comment }: CommentItemProps) {
  const menu = (
    <Menu>
      <Menu.Item key="block">
        Block @{comment.userName}
      </Menu.Item>
    </Menu>
  );

  return (
    <Card className="comment-item">
      <div className="comment-header">
        <div className="comment-avatar">{comment.userName[0]}</div>
        <div className="comment-user-info">
          <Text strong>{comment.userName}</Text>
          <Tooltip title={comment.createdAt.toLocaleString()}>
            <Text type="secondary" className="comment-date">
              {comment.createdAt.toLocaleString()}
            </Text>
          </Tooltip>
        </div>
        <div className="comment-actions-right">
         
          <Dropdown overlay={menu} trigger={['click']}>
            <Button type="text" icon={<MoreOutlined />} />
          </Dropdown>
        </div>
      </div>
      <div className="comment-body">
        <Typography.Paragraph className="comment-text">{comment.text}</Typography.Paragraph>
        <CommentFooter postId={comment.id} />
      </div>
    </Card>
  );
}