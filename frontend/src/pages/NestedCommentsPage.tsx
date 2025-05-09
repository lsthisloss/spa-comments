import { useEffect, useState, useContext } from 'react';
import { useParams } from 'react-router-dom';
import { WebSocketContext } from '../services/WebSocketContext';
import CommentItem from '../components/comments/CommentItem';
import CommentForm from '../components/comments/CommentForm';
import { Comment } from '../types/comment';
import '../styles/main.scss';
import { Pagination, Spin } from 'antd';

export default function NestedCommentsPage() {
  const { parentId } = useParams<{ parentId: string }>();
  const socket = useContext(WebSocketContext);
  const [parentComment, setParentComment] = useState<Comment | null>(null);
  const [childComments, setChildComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 25;

  useEffect(() => {
    if (socket && parentId) {
      setLoading(true);
      socket.emit(
        'fetchNestedComments',
        { parentId, limit: pageSize, offset: (page - 1) * pageSize },
        ({ parent, children, total }: { parent: Comment; children: Comment[]; total: number }) => {
          const sortedChildren = children.slice().sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          setParentComment(parent);
          setChildComments(sortedChildren);
          setTotal(total || sortedChildren.length);
          setLoading(false);
        }
      );
    }
  }, [socket, parentId, page]);

  const handleNewChildComment = (newComment: Comment) => {
    console.log('New child comment received via WebSocket:', newComment);
    setChildComments((prevComments) => [newComment, ...prevComments]);
  };

  useEffect(() => {
    if (socket) {
      socket.on('newComment', handleNewChildComment);

      return () => {
        socket.off('newComment', handleNewChildComment);
      };
    }
  }, [socket]);

  if (loading) {
      <div className="loading-container">
      <Spin tip="Loading..." size="large" />
    </div>
    }

  return (
    <section className="nested-comments-page">
      {parentComment && (
        <div className="parent-comment">
          <CommentItem comment={parentComment} level={0} disableShowMore/>
        </div>
      )}
      <div className="comment-form">
        <CommentForm parentId={parentId} placeholder="Post your reply..." />
      </div>
      <div className="child-comments">
        {childComments.map((comment) => (
          <CommentItem key={comment.id} comment={comment} level={1} />
        ))}
        <Pagination
          current={page}
          pageSize={pageSize}
          total={total}
          onChange={setPage}
          style={{ marginTop: 16, textAlign: 'center' }}
        />
      </div>
    </section>
  );
}