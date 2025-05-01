import CommentItem from './CommentItem';
import { Comment as CommentType } from '../types/comment';
import { JSX } from 'react';

const dummyComments: CommentType[] = [
  {
    id: '1',
    userName: 'JohnDoe',
    email: 'john@example.com',
    text: 'This is a top-level comment.',
    createdAt: new Date(),
    parentId: null,
  },
  {
    id: '2',
    userName: 'JaneDoe',
    email: 'jane@example.com',
    text: 'This is a reply to the top-level comment.',
    createdAt: new Date(),
    parentId: '1',
  },
  {
    id: '3',
    userName: 'Alice',
    email: 'alice@example.com',
    text: 'This is a reply to JaneDoe.',
    createdAt: new Date(),
    parentId: '2',
  },
];

export default function CommentList() {
  const renderComments = (parentId: string | null, level: number = 0): JSX.Element[] => {
    return dummyComments
      .filter((comment) => comment.parentId === parentId)
      .map((comment) => (
        <CommentItem key={comment.id} comment={comment} level={level}>
          {renderComments(comment.id, level + 1)}
        </CommentItem>
      ));
  };

  return <div>{renderComments(null)}</div>;
}