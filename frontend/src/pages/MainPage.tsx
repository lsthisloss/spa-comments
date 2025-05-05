import { useEffect, useState, useContext } from 'react';
import { Pagination, Spin } from 'antd';
import CommentsPage from './CommentsPage';
import { WebSocketContext } from '../components/WebSocketContext';
import '../styles/main.scss';
import { useLocation } from 'react-router-dom';
import { Comment as FullComment } from '../types/comment'; // Импортируем существующий тип
type CommentNo = Omit<FullComment, 'homePage'>; // Исключаем поле homePage

export default function MainPage() {
  const [comments, setComments] = useState<CommentNo[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalComments, setTotalComments] = useState(0);
  const socket = useContext(WebSocketContext);
  const location = useLocation();

  const COMMENTS_PER_PAGE = 25;

  useEffect(() => {
    if (socket) {
      console.log('Requesting comments for page:', currentPage);
      setLoading(true);

      socket.emit(
        'fetchComments',
        { page: currentPage, limit: COMMENTS_PER_PAGE },
        ({ comments, total }: { comments: FullComment[]; total: number }) => {
          console.log('Fetched comments via WebSocket:', comments);
          setComments(
            comments.map((comment) => ({
              ...comment,
              createdAt: new Date(comment.createdAt),
            })),
          );
          setTotalComments(total);
          setLoading(false);
        },
      );
    }
  }, [socket, currentPage]);

  useEffect(() => {
    if (socket) {
      const handleNewComment = (newComment: FullComment) => {
        console.log('New comment received via WebSocket:', newComment);

        if (currentPage === 1) {
          setComments((prevComments) => {
            const updatedComments = [
              { ...newComment, createdAt: new Date(newComment.createdAt) },
              ...prevComments.slice(0, COMMENTS_PER_PAGE - 1),
            ];
            console.log('Updated comments after WebSocket event:', updatedComments);
            return updatedComments;
          });
        }
        setTotalComments((prevTotal) => prevTotal + 1);
      };

      socket.on('newComment', handleNewComment);

      return () => {
        socket.off('newComment', handleNewComment);
      };
    }
  }, [socket, currentPage]);

  useEffect(() => {
    if (location.state?.resetPage) {
      setCurrentPage(1);
    }
  }, [location.state]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <section className="main-page">
      {loading ? (
        <div className="loading-container">
          <Spin tip="Loading..." size="large" />
        </div>
      ) : (
        <>
          <CommentsPage comments={comments} />
          <Pagination
            current={currentPage}
            pageSize={COMMENTS_PER_PAGE}
            total={totalComments}
            onChange={handlePageChange}
            showSizeChanger={false}
            simple
            style={{ marginTop: '16px', textAlign: 'center' }}
          />
          <div className="main-page-section"></div>
        </>
      )}
    </section>
  );
}