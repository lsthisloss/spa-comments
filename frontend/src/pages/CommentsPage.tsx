import { Comment } from '../types/comment';
import CommentList from '../components/comments/CommentList';
import CommentForm from '../components/comments/CommentForm';
import React from 'react';

interface CommentsPageProps {
  comments: Comment[];  
  newCommentsBar?: React.ReactNode;

}

const CommentsPage = React.memo(({ comments, newCommentsBar }: CommentsPageProps) => {
  return (
    <section className="comments-page">
      <div className="comment-container">
        <div className="comment-form">
          <CommentForm />
        </div>
        <div className="divider"></div>
        {newCommentsBar && <div className="new-comments-bar-container">{newCommentsBar}</div>}
        <div className="comment-list">
          <CommentList comments={comments} />
        </div>
      </div>
    </section>
  );
});
export default CommentsPage;