import { useEffect, useState, useContext, useRef } from 'react';
import { Pagination, Spin, Button } from 'antd';
import CommentsPage from './CommentsPage';
import { WebSocketContext } from '../components/WebSocketContext';
import '../styles/main.scss';
import { useLocation } from 'react-router-dom';
import { Comment as FullComment } from '../types/comment'; // Импортируем существующий тип
import { DownOutlined } from '@ant-design/icons';
type CommentNo = Omit<FullComment, 'homePage'>; // Исключаем поле homePage

export default function MainPage() {
  const [comments, setComments] = useState<CommentNo[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalComments, setTotalComments] = useState(0);
  const [newCommentsCount, setNewCommentsCount] = useState(0); // Количество новых комментариев
  const [manualUpdateMode, setManualUpdateMode] = useState(false); // Режим ручного обновления
  const socket = useContext(WebSocketContext);
  const location = useLocation();

  const COMMENTS_PER_PAGE = 25;
  const MAX_COMMENTS_THRESHOLD = 100; 
  const TIME_WINDOW_MS = 10000;
  const commentBuffer = useRef<FullComment[]>([]);
  const newCommentsCounter = useRef(0); 
  useEffect(() => {
    if (socket) {
      console.log('Requesting comments for page:', currentPage);
      setComments([]); 
      setLoading(true);
  
      socket.emit(
        'fetchComments',
        { page: currentPage, limit: COMMENTS_PER_PAGE },
        ({ comments, total }: { comments: FullComment[]; total: number }) => {
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

        commentBuffer.current.push({
          ...newComment,
          createdAt: new Date(newComment.createdAt),
        });

        setNewCommentsCount((prevCount) => prevCount + 1);
        newCommentsCounter.current += 1;
      };

      socket.on('newComment', handleNewComment);

      return () => {
        socket.off('newComment', handleNewComment);
      };
    }
  }, [socket]);

    useEffect(() => {
      const interval = setInterval(() => {
        if (newCommentsCounter.current >= MAX_COMMENTS_THRESHOLD) {
          setManualUpdateMode(true); 
        } else if (!manualUpdateMode && commentBuffer.current.length > 0) {
          setComments((prevComments) => {
            const newComments = commentBuffer.current.splice(0, commentBuffer.current.length);
            const updatedComments = [...newComments, ...prevComments];
            console.log('Auto-updated comments:', updatedComments);
            return updatedComments;
          });
          setNewCommentsCount(0);
        }
        newCommentsCounter.current = 0;
      }, TIME_WINDOW_MS);
    
      return () => clearInterval(interval);
    }, [manualUpdateMode]);

    const handleLoadNewComments = () => {
      setComments((prevComments) => {
        const newComments = commentBuffer.current.splice(0, commentBuffer.current.length);
        const updatedComments = [...newComments, ...prevComments]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) 
          .slice(0, 25);
        console.log('Manually loaded new comments:', updatedComments);
        return updatedComments;
      });
    
      setNewCommentsCount(0);
      setManualUpdateMode(false);
    };



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
          <Spin tip="Loading..." size="large"/>
          </div>
      ) : (
        <>
          <CommentsPage
            comments={comments} 
            newCommentsBar={
              manualUpdateMode && newCommentsCount > 0 && (
                <div className="new-comments-bar">
                  <Button
                    type="text"
                    className="new-comments-button"
                    onClick={handleLoadNewComments}
                  >
                    <span>{newCommentsCount} new posts</span>
                    <DownOutlined />
                  </Button>
                </div>
              )
            }
          />
          <Pagination
            current={currentPage}
            pageSize={COMMENTS_PER_PAGE}
            total={totalComments}
            onChange={handlePageChange}
            showSizeChanger={false}
            simple
            style={{ marginTop: '16px', textAlign: 'center' }}
          />
        </>
      )}
    </section>
  );
}
