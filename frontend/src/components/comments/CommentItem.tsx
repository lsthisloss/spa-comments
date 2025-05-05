import { Tooltip, Card, Typography } from 'antd';
import '../../styles/main.scss';
import CommentFooter from './CommentFooter';

const { Text, Paragraph } = Typography;

interface CommentItemProps {
  comment: {
    id: string;
    userName: string;
    text: string;
    createdAt: Date;
  };
  level: number;
}

const getRandomGradient = () => {
  const colors = [
    ['#4e54c8', '#8f94fb'], 
    ['#ff758c', '#ff7eb3'], 
    ['#6a11cb', '#2575fc'], 
    ['#ff9a9e', '#fad0c4'],
    ['#fbc2eb', '#a18cd1'],
    ['#00c6ff', '#0072ff'],
    ['#f6d365', '#fda085'],
  ];
  const randomIndex = Math.floor(Math.random() * colors.length);
  return `linear-gradient(135deg, ${colors[randomIndex][0]}, ${colors[randomIndex][1]})`;
};

export default function CommentItem({ comment }: CommentItemProps) {
  const avatarLetter = comment.userName.charAt(0).toUpperCase();
  const avatarGradient = getRandomGradient();

  return (
    <Card className="comment-item">
      <div className="comment-layout">
        <div
          className="comment-avatar"
          style={{ background: avatarGradient }}
          >
          {avatarLetter}
        </div>
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
            <Paragraph className="comment-text">{comment.text}</Paragraph>
          </div>
          <CommentFooter postId={comment.id} />
        </div>
      </div>
    </Card>
  );
}