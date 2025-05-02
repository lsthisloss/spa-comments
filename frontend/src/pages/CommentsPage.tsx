import CommentForm from '../components/Comments/CommentForm';
import CommentList from '../components/Comments/CommentList';
import '../styles/Comments/CommentsPage.css'; // Import your CSS file here

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