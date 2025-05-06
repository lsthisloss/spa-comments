import { Tooltip, Card, Typography, Image } from 'antd';
import '../../styles/main.scss';
import CommentFooter from './CommentFooter';
import { FileTextOutlined } from '@ant-design/icons';
import { getAvatarColor } from '../particles/avatarColor';

const { Text } = Typography;
const apiUrl = 'http://localhost:3001';


interface CommentItemProps {
  comment: {
    id: string;
    userName: string;
    text: string;
    createdAt: Date;
    imageUrl?: string;
    image?: string;
    file?: {
      name: string;
      type: string;
      size: number;
      buffer: number[];
    };
    fileUrl?: string;
    fileName?: string;
    likes?: number;
  };
  level: number;
}

const CommentItem: React.FC<CommentItemProps> = ({ comment }) => {
  const avatarLetter = comment.userName.charAt(0).toUpperCase();
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
            className="comment-text"
            dangerouslySetInnerHTML={{ __html: comment.text.replace(/\n/g, '<br/>') }}
            />
          {comment.imageUrl && (
            <>
              <div
                style={{
                  display: 'inline-block', 
                  maxWidth: '100%',
                  maxHeight: '100%',
                  borderRadius: '8px',
                  overflow: 'hidden', 
                }}
              >
                <Image
                  src={comment.imageUrl.startsWith('http') ? comment.imageUrl : `${apiUrl}${comment.imageUrl}`}
                  alt="Comment attachment"
                  className="comment-image ant-image-img"
                  style={{
                    maxWidth: '180px',
                    maxHeight: '120px',
                    borderRadius: '8px',
                    textAlign: 'center',
                    cursor: 'pointer',
                  }}
                  preview={true}
                />
              </div>
              <div style={{ height: '16px' }} />
            </>
          )}
          {comment.fileUrl && comment.fileName && (
              <div className="comment-file">
              <a
                href={comment.fileUrl?.startsWith('http') ? comment.fileUrl : `${apiUrl}${comment.fileUrl}`}
                download={comment.fileName || true}
                rel="noopener noreferrer"
                >
                <FileTextOutlined style={{ marginRight: '8px' }} />
                <span>{comment.fileName}</span>
              </a>
            </div>
            )}
          <CommentFooter postId={comment.id} initialLikes={comment.likes || 0} />
        </div> 
      </div>
    </Card>
  );
};

export default CommentItem;