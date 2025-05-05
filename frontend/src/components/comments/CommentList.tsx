import React from 'react';
import CommentItem from './CommentItem';
import { Comment } from '../../types/comment';
import '../../styles/main.scss';

interface CommentListProps {
  comments: Comment[];
}

const CommentList = React.memo(({ comments }: CommentListProps) => {
  console.log('Rendering CommentList with comments:', comments);

  return (
    <div className="posts-container">
      {comments.map((comment, index) => (
        <CommentItem key={`${comment.id}-${index}`} comment={comment} level={0} />
      ))}
    </div>
  );
});

export default CommentList;