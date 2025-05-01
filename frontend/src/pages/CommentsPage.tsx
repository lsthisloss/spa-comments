import CommentForm from '../components/CommentForm';
import CommentList from '../components/CommentList';
import '../styles/CommentsPage.css';

export default function CommentsPage() {
  return (
    <section className="comments-page">
      <div className="comments-container">
        <div className="comment-form">
          <CommentForm />
        </div>
        <div className="divider"></div>
        <div className="comment-list">
          <CommentList />
        </div>
      </div>
    </section>
  );
}