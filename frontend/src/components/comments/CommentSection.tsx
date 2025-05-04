import CommentList from './CommentList';
import CommentForm from './CommentForm';
import '../../styles/main.scss';

interface CommentSectionProps {
  postId: string;
}

export default function CommentSection({ postId }: CommentSectionProps) {
  return (
    <div className="comment-section">
      <CommentForm />
      <CommentList postId={postId} />
    </div>
  );
}