import { Tooltip, Card, Typography} from 'antd';
import '../../styles/main.scss';
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
  return (
    <>
      <Card className="comment-item">
        <div className="comment-layout">
          <div className="comment-avatar">{comment.userName[0]}</div>
          <div className="comment-content">
                <div className="comment-user-info">
                  <Text strong>{comment.userName}</Text>
                  <span className="comment-separator">·</span>
                  <Tooltip title={comment.createdAt.toLocaleString()}>
                    <Text type="secondary" className="comment-date">
                      {comment.createdAt.toLocaleString()}
                    </Text>
                  </Tooltip>
                </div>
            <div className="comment-body">
              <Typography.Paragraph className="comment-text">{comment.text}</Typography.Paragraph>
            </div>
            <CommentFooter postId={comment.id} />
          </div>
        </div>
      </Card>
    </>
  );
}