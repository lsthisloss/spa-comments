import { Comment } from '../types/comment';
import CommentList from '../components/comments/CommentList';
import CommentForm from '../components/comments/CommentForm';

interface CommentsPageProps {
  comments: Comment[];
}

const CommentsPage = ({ comments }: CommentsPageProps) => {
  if (!comments || comments.length === 0) {
    return <p>No comments available.</p>;
  }

  return (
    <section className="comments-page">
      <div className="comment-container">
        <div className="comment-form">
          <CommentForm />
        </div>
        <div className="divider"></div>
        <div className="comment-list">
          <CommentList comments={comments} />
        </div>
      </div>
    </section>
  );
};

export default CommentsPage;