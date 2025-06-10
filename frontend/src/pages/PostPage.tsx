import { useParams, useNavigate } from 'react-router-dom';
import { usePostStore, useCommentStore, useUserStore } from '../hooks/useStore';
import { Empty, Button, Spin } from 'antd';
import PostItem from '../components/posts/PostItem';
import CommentsThread from '../components/comments/CommentsThread';
import SendForm from '../components/common/SendForm';
import { LeftOutlined, HomeOutlined } from '@ant-design/icons';
import { logger } from "../utils/Logger";
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { observer } from 'mobx-react-lite';

/*
  Страница отдельного поста с комментариями.
  Позволяет просматривать пост, добавлять комментарии и видеть комментарии других пользователей.
  Используется в ленте постов и профиле пользователя.
*/
const PostPage = observer(() => {
  const postStore = usePostStore();
  const commentStore = useCommentStore();
  const userStore = useUserStore();
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const mountedRef = useRef(true);
  const [loading, setLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Ищем пост по slug
  const post = useMemo(() => {
    if (!slug) return null;
    return postStore.getPostBySlug(slug);
  }, [slug, postStore]);

  // Загрузка поста - с защитой от StrictMode
  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }

    // Проверяем есть ли уже пост
    const existingPost = postStore.getPostBySlug(slug);
    if (existingPost) {
      console.log(`[PostPage] Post already exists:`, existingPost.id);
      setLoading(false);
      setError(null);
      return;
    }

    // ЗАЩИТА ОТ REACT STRICTMODE - проверяем активные запросы
    const activePromise = postStore.fetchPostPromises.get(slug);
    if (activePromise) {
      console.log(`[PostPage] Request already in progress for: ${slug}, reusing promise`);
      
      activePromise
        .then(fetchedPost => {
          if (!mountedRef.current) return;
          if (fetchedPost) {
            console.log(`[PostPage] Post loaded from active promise:`, fetchedPost.id);
            setLoading(false);
            setError(null);
          } else {
            setError('Post not found');
            setLoading(false);
          }
        })
        .catch((error) => {
          if (!mountedRef.current) return;
          console.error(`[PostPage] Failed to load post from active promise:`, error);
          setError('Failed to load post');
          setLoading(false);
        });
      return;
    }

    console.log(`[PostPage] Starting NEW fetch for:`, slug);
    setLoading(true);
    setError(null);

    // 3агружаем пост
    postStore.fetchPostBySlug(slug)
      .then(fetchedPost => {
        if (!mountedRef.current) return;
        if (fetchedPost) {
          console.log(`[PostPage] Post loaded:`, fetchedPost.id);
          setLoading(false);
          setError(null);
        } else {
          setError('Post not found');
          setLoading(false);
        }
      })
      .catch((error) => {
        if (!mountedRef.current) return;
        console.error(`[PostPage] Failed to load post:`, error);
        setError('Failed to load post');
        setLoading(false);
      });

  }, [slug, postStore]);
  
  // Загрузка поста по slug
  const handleLoadMoreComments = useCallback(() => {
    if (!post?.id || commentsLoading) return;
    setCommentsLoading(true);
    commentStore.loadMoreComments(post.id, 10)
      .finally(() => setCommentsLoading(false));
  }, [post?.id, commentsLoading, commentStore]);

  const handleCommentSuccess = useCallback(() => {
    logger.log(`[PostPage] Comment added successfully`);
  }, []);

  const handleGoBack = useCallback(() => {
    logger.log(`[PostPage] Going back from post`);
    navigate(-1);
  }, [navigate]);

  return (
    <section className="post-page-container">
      <div className="post-header">
        <Button
          type="text"
          icon={<LeftOutlined />}
          onClick={handleGoBack}
          style={{ marginRight: 8 }}
        />
        <span className="post-span">Post</span>
        <Button
          type="text"
          icon={<HomeOutlined />}
          onClick={() => navigate('/')}
          style={{ marginLeft: 'auto' }}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Spin size="large" />
          <p>Loading post...</p>
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Empty description={error} />
        </div>
      ) : post ? (
        <>
          <div className="post-container">
            <PostItem post={post} hideCommentButton={true} />
          </div>

          {userStore.user && (
            <div className="comment-form-container">
              <SendForm
                type="comment"
                postSlug={post.slug}
                placeholder="Add a comment..."
                onSuccess={handleCommentSuccess}
              />
            </div>
          )}

          <div className="comments-section">
            <CommentsThread
              postSlug={post.slug}
              loading={commentsLoading}
              onLoadMore={handleLoadMoreComments}
              autoLoad={true}
            />
          </div>
        </>
      ) : (
        <Empty description="Post not found" />
      )}
    </section>
  );
});

export default PostPage;