import { useState } from 'react';
import { useParams } from 'react-router-dom';
import CommentForm from '../components/comments/CommentForm';
import CommentList from '../components/comments/CommentList';
import '../styles/main.scss';

export default function CommentsPage() {
  const { postId } = useParams<{ postId: string }>();
  const totalPosts = 42; 
  const [activeTab, setActiveTab] = useState('Posts'); 

  return (
    <section className="comments-page">
      <div className="tabs">
        <div
          className={`tab ${activeTab === 'Posts' ? 'active-tab' : ''}`}
          onClick={() => setActiveTab('Posts')}>
            {totalPosts} Posts
        </div>
      </div>
      <div className="comment-container">
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