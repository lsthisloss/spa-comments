import { useEffect, useState, useContext } from 'react';
import { useParams } from 'react-router-dom';
import { WebSocketContext } from '../components/WebSocketContext';
import CommentItem from '../components/comments/CommentItem';
import CommentForm from '../components/comments/CommentForm';
import { Comment } from '../types/comment';
import '../styles/main.scss';
import { Spin } from 'antd';

export default function NestedCommentsPage() {
  const { parentId } = useParams<{ parentId: string }>();
  const socket = useContext(WebSocketContext);
  const [parentComment, setParentComment] = useState<Comment | null>(null);
  const [childComments, setChildComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (socket && parentId) {
      console.log(`Fetching parent comment and child comments for parentId: ${parentId}`);
      setLoading(true);

      socket.emit('fetchNestedComments', { parentId }, ({ parent, children }: { parent: Comment; children: Comment[] }) => {
        console.log('Fetched parent comment and child comments:', { parent, children });
        setParentComment(parent);
        setChildComments(children);
        setLoading(false);
      });
    }
  }, [socket, parentId]);

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
          <CommentItem comment={parentComment} level={0} />
        </div>
      )}
      <div className="comment-form">
        <CommentForm parentId={parentId} placeholder="Post your reply..." />
      </div>
      <div className="child-comments">
        {childComments.map((comment) => (
          <CommentItem key={comment.id} comment={comment} level={1} />
        ))}
      </div>
    </section>
  );
}