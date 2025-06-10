import { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { useNavigate } from "react-router-dom";
import { useSocketStore } from "../../../hooks/useStore";

/*
  Компонент для отображения модального окна поиска по пользователям, постам и комментариям.
  Используется для быстрого поиска контента в приложении.
  Позволяет искать пользователей, посты и комментарии по ключевым словам.
  Результаты отображаются в виде вкладок с возможностью перехода к найденным элементам.
*/

export const SearchModal = observer(function SearchModal({
  visible,
  onClose
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  type SearchResults = {
    users: {
      userName: string;
      email: string;
      avatarUrl?: string;
      slug?: string;
      avatarShape?: string;
      role?: string;
    }[];
    posts: {
      id: string;
      content: string;
      slug?: string;
      likes?: number;
      repliesCount?: number;
      fileName?: string;
      createdAt?: string;
      author?: {
        userName: string;
        avatarUrl?: string;
        slug?: string;
        avatarShape?: string;
      };
    }[];
    comments: {
      id: string;
      content: string;
      slug?: string;
      likes?: number;
      postId?: string;
      createdAt?: string;
      author?: {
        userName: string;
        avatarUrl?: string;
        slug?: string;
        avatarShape?: string;
      };
      post?: {
        id: string;
        slug: string;
        content: string;
      };
    }[];
  };

  const [results, setResults] = useState<SearchResults>({ users: [], posts: [], comments: [] });
  const [activeTab, setActiveTab] = useState("users");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const navigate = useNavigate();
  const socketStore = useSocketStore();

  useEffect(() => {
    if (!visible) {
      setQuery("");
      setResults({ users: [], posts: [], comments: [] });
      setActiveTab("users");
    }
  }, [visible]);

  useEffect(() => {
    if (!socketStore.search) return;
    if (query.length < 3) {
      setResults({ users: [], posts: [], comments: [] });
      return;
    }
    setLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      socketStore.search?.emit("search", { query }, (res: SearchResults) => {
        setResults(res);
        setLoading(false);
      });
    }, query.length === 3 ? 0 : 150);
  }, [query, visible, socketStore.search]);

  useEffect(() => {
    if (visible) {
      document.body.classList.add('search-modal-open');
    } else {
      document.body.classList.remove('search-modal-open');
    }

    return () => {
      document.body.classList.remove('search-modal-open');
    };
  }, [visible]);

  const handleUserClick = (user: SearchResults['users'][0]) => {
    if (user.slug) {
      navigate(`/profile/${user.slug}`);
      onClose();
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };
const handlePostClick = (post: SearchResults['posts'][0]) => {
  console.log('[SearchModal] Post data:', post);
  
  const identifier = post.slug || post.id;
  
  if (identifier) {
    console.log('[SearchModal] Navigating to post:', identifier);
    
    // Если есть slug - используем его, если нет - используем ID через другой роут
    if (post.slug) {
      navigate(`/post/${post.slug}`);
    } else if (post.id) {
       navigate(`/post/${post.id}`);
    }
    onClose();
  } else {
    console.warn('[SearchModal] No valid identifier for post:', post);
  }
};

  const handleCommentClick = (comment: SearchResults['comments'][0]) => {
    if (comment.post?.slug) {
      navigate(`/post/${comment.post.slug}#comment-${comment.id}`);
      onClose();
    }
  };

  if (!visible) return null;

  return (
    <div className="search-modal-overlay" onClick={handleBackdropClick}>
      <div className="search-modal">
        <div className="search-modal__header">
          <input
            type="text"
            placeholder="Search users, posts, comments..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="search-modal__input"
            autoFocus
          />
          <button className="search-modal__close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="search-modal__tabs">
          <button
            className={`search-modal__tab ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            👤 Users ({results.users.length})
          </button>
          <button
            className={`search-modal__tab ${activeTab === 'posts' ? 'active' : ''}`}
            onClick={() => setActiveTab('posts')}
          >
            📄 Posts ({results.posts.length})
          </button>
          <button
            className={`search-modal__tab ${activeTab === 'comments' ? 'active' : ''}`}
            onClick={() => setActiveTab('comments')}
          >
            💬 Comments ({results.comments.length})
          </button>
        </div>

        <div className="search-modal__content">
          {loading ? (
            <div className="search-modal__loading">
              <div className="spinner"></div>
              Searching...
            </div>
          ) : (
            <>
              {activeTab === 'users' && (
                <div className="search-modal__results">
                  {results.users.length === 0 ? (
                    <div className="search-modal__empty">No users found</div>
                  ) : (
                    results.users.map((user, index) => (
                      <div
                        key={index}
                        className="search-modal__item user"
                        onClick={() => handleUserClick(user)}
                      >
                        <div className="search-modal__avatar">
                          {user.avatarUrl ? (
                            <img src={user.avatarUrl} alt={user.userName} />
                          ) : (
                            <div className="avatar-placeholder">
                              {user.userName.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="search-modal__info">
                          <div className="search-modal__name">
                            {user.userName}
                            {user.role && (
                              <span className={`role-badge ${user.role}`}>
                                {user.role.toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="search-modal__email">{user.email}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
              {activeTab === 'posts' && (
                <div className="search-modal__results">
                  {results.posts.length === 0 ? (
                    <div className="search-modal__empty">No posts found</div>
                  ) : (
                    results.posts.map((post, index) => (
                      <div
                        key={index}
                        className="search-modal__item post"
                        onClick={() => handlePostClick(post)}
                      >
                        <div className="search-modal__avatar">
                          {post.author?.avatarUrl ? (
                            <img src={post.author.avatarUrl} alt={post.author.userName} />
                          ) : (
                            <div className="avatar-placeholder">
                              {post.author?.userName?.charAt(0).toUpperCase() || '?'}
                            </div>
                          )}
                        </div>
                        <div className="search-modal__info">
                          <div className="search-modal__name">
                            {post.author?.userName || 'Anonymous'}
                            <span className="search-modal__meta">
                              {post.likes && `❤️ ${post.likes}`}
                              {post.repliesCount && ` 💬 ${post.repliesCount}`}
                            </span>
                          </div>
                          <div className="search-modal__content">
                            {post.content.length > 100
                              ? `${post.content.substring(0, 100)}...`
                              : post.content
                            }
                          </div>
                          {post.fileName && (
                            <div className="search-modal__attachment">
                              📎 {post.fileName}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'comments' && (
                <div className="search-modal__results">
                  {results.comments.length === 0 ? (
                    <div className="search-modal__empty">No comments found</div>
                  ) : (
                    results.comments.map((comment, index) => (
                      <div
                        key={index}
                        className="search-modal__item comment"
                        onClick={() => handleCommentClick(comment)}
                      >
                        <div className="search-modal__avatar">
                          {comment.author?.avatarUrl ? (
                            <img src={comment.author.avatarUrl} alt={comment.author.userName} />
                          ) : (
                            <div className="avatar-placeholder">
                              {comment.author?.userName?.charAt(0).toUpperCase() || '?'}
                            </div>
                          )}
                        </div>
                        <div className="search-modal__info">
                          <div className="search-modal__name">
                            {comment.author?.userName || 'Anonymous'}
                            <span className="search-modal__meta">
                              {comment.likes && `❤️ ${comment.likes}`}
                            </span>
                          </div>
                          <div className="search-modal__content">
                            {comment.content.length > 80
                              ? `${comment.content.substring(0, 80)}...`
                              : comment.content
                            }
                          </div>
                          {comment.post && (
                            <div className="search-modal__post-ref">
                              💬 Reply to: {comment.post.content.substring(0, 50)}...
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
});