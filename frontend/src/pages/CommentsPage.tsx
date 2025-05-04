import { useState } from 'react';
import { useParams } from 'react-router-dom';
import CommentForm from '../components/comments/CommentForm';
import CommentList from '../components/comments/CommentList';
import SubscriberForm from '../components/particles/SubscriberForm';
import '../styles/main.scss';

export default function CommentsPage() {
  const { postId } = useParams<{ postId: string }>();
  const totalPosts = 42; 
  const [activeTab, setActiveTab] = useState('Posts'); 
  const [isSubscriberFormVisible, setSubscriberFormVisible] = useState(false);

  const handleTabClick = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'Who Am I') {
      setSubscriberFormVisible(true);
    } else {
      setSubscriberFormVisible(false);
    }
  };

  const handleCloseSubscriberForm = () => {
    setSubscriberFormVisible(false); 
    setActiveTab('Posts'); 
  };

  return (
    <section className="comments-page">
      <div className="tabs">
        <div
          className={`tab ${activeTab === 'Posts' ? 'active-tab' : ''}`}
          onClick={() => handleTabClick('Posts')}>
            {totalPosts} Posts
        </div>
        <div
          className={`tab ${activeTab === 'Who Am I' ? 'active-tab' : ''}`}
          onClick={() => handleTabClick('Who Am I')}>
            Who Am I
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

      {/* SubscriberForm Modal */}
      {isSubscriberFormVisible && (
        <SubscriberForm
          visible={isSubscriberFormVisible}
          onClose={handleCloseSubscriberForm}
        />
      )}
    </section>
  );
}