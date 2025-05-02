import { useParams } from 'react-router-dom';
import CommentForm from '../components/Comments/CommentForm';
import CommentList from '../components/Comments/CommentList';
import '../styles/Comments/CommentsPage.css';

export default function CommentsPage() {
  const { postId } = useParams<{ postId: string }>();

  return (
    <section className="comments-page">
      <div className="comments-container">
        <div className="comment-form">
          <CommentForm />
        </div>
        <div className="divider"></div>
        <div className="comment-list">
          <CommentList postId={postId} />
        </div>
      </div>
    </section>
  );
}