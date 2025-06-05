import { useEffect, useRef, useState } from "react";
import { Modal, Input, Tabs, List, Avatar, Spin, Typography, Tag } from "antd";
import { UserOutlined, MessageOutlined, InboxOutlined } from "@ant-design/icons";
import { observer } from "mobx-react-lite";
import { useNavigate } from "react-router-dom";
import { useSocketStore } from "../../../hooks/useStore";

const { Text, Paragraph } = Typography;

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

  // Универсальный рендер аватарки
  const renderAvatar = (avatarUrl?: string) =>
    avatarUrl && avatarUrl.trim() !== "" ? (
      <Avatar src={avatarUrl} />
    ) : (
      <Avatar icon={<UserOutlined />} />
    );

  // Форматирование даты
  const formatDate = (dateString?: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  // Сокращение текста
  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + "...";
  };

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      footer={null}
      width={700}
      style={{ top: 40 }}
      destroyOnHidden
      className="search-modal"
      centered
    >
      <div style={{ padding: 24, background: "#fff", borderRadius: 8 }}>
        <Input.Search
          placeholder="Search users, posts, comments..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          allowClear
          size="large"
          autoFocus
        />
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          style={{ marginTop: 16 }}
          items={[
            {
              key: "users",
              label: <>
                <UserOutlined /> Users ({results.users.length})
              </>,
              children: (
                <List
                  loading={loading}
                  dataSource={results.users}
                  renderItem={user => (
                    <List.Item
                      style={{ cursor: user.slug ? "pointer" : "default" }}
                      onClick={() => user.slug && navigate(`/profile/${user.slug}`)}
                    >
                      <List.Item.Meta
                        avatar={renderAvatar(user.avatarUrl)}
                        title={
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span>{user.userName}</span>
                            {user.role && (
                              <Tag 
                                color={
                                  user.role === 'admin' ? 'red' : 
                                  user.role === 'superadmin' ? 'purple' : 
                                  user.role === 'test' ? 'orange' : 'default'
                                }
                              >
                                {user.role.toUpperCase()}
                              </Tag>
                            )}
                          </div>
                        }
                        description={user.email}
                      />
                    </List.Item>
                  )}
                  locale={{ emptyText: loading ? <Spin /> : "No users found" }}
                />
              ),
            },
            {
              key: "posts",
              label: <>
                <InboxOutlined /> Posts ({results.posts.length})
              </>,
              children: (
                <List
                  loading={loading}
                  dataSource={results.posts}
                  renderItem={post => (
                    <List.Item
                      style={{ cursor: post.slug ? "pointer" : "default" }}
                      onClick={() => post.slug && navigate(`/post/${post.slug}`)}
                    >
                      <List.Item.Meta
                        avatar={renderAvatar(post.author?.avatarUrl)}
                        title={
                          <div>
                            {/* Автор сверху */}
                            <div style={{ marginBottom: 4 }}>
                              {post.author?.userName && post.author?.slug ? (
                                <Text
                                  style={{ color: "#1677ff", cursor: "pointer", fontWeight: 500 }}
                                  onClick={e => {
                                    e.stopPropagation();
                                    navigate(`/profile/${post.author?.slug}`);
                                  }}
                                >
                                  {post.author.userName}
                                </Text>
                              ) : (
                                <Text type="secondary">{post.author?.userName || "Unknown User"}</Text>
                              )}
                              {formatDate(post.createdAt) && (
                                <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                                  • {formatDate(post.createdAt)}
                                </Text>
                              )}
                            </div>
                            {/* Контент поста */}
                            <Paragraph 
                              style={{ margin: 0, color: "#333" }}
                              ellipsis={{ rows: 2, expandable: false }}
                            >
                              {post.content}
                            </Paragraph>
                          </div>
                        }
                        description={
                          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 4 }}>
                            {post.fileName && (
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                📎 {post.fileName}
                              </Text>
                            )}
                            {typeof post.likes === 'number' && post.likes > 0 && (
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                ❤️ {post.likes}
                              </Text>
                            )}
                            {typeof post.repliesCount === 'number' && post.repliesCount > 0 && (
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                💬 {post.repliesCount}
                              </Text>
                            )}
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                  locale={{ emptyText: loading ? <Spin /> : "No posts found" }}
                />
              ),
            },
            {
              key: "comments",
              label: <>
                <MessageOutlined /> Comments ({results.comments.length})
              </>,
              children: (
                <List
                  loading={loading}
                  dataSource={results.comments}
                  renderItem={comment => (
                    <List.Item
                      style={{ cursor: comment.slug ? "pointer" : "default" }}
                      onClick={() => {
                        // Переходим к посту, где находится комментарий
                        if (comment.post?.slug) {
                          navigate(`/post/${comment.post.slug}#comment-${comment.id}`);
                        } else if (comment.slug) {
                          navigate(`/comment/${comment.slug}`);
                        }
                      }}
                    >
                      <List.Item.Meta
                        avatar={renderAvatar(comment.author?.avatarUrl)}
                        title={
                          <div>
                            {/* Автор комментария сверху */}
                            <div style={{ marginBottom: 4 }}>
                              {comment.author?.userName && comment.author?.slug ? (
                                <Text
                                  style={{ color: "#1677ff", cursor: "pointer", fontWeight: 500 }}
                                  onClick={e => {
                                    e.stopPropagation();
                                    navigate(`/profile/${comment.author?.slug}`);
                                  }}
                                >
                                  {comment.author.userName}
                                </Text>
                              ) : (
                                <Text type="secondary">{comment.author?.userName || "Unknown User"}</Text>
                              )}
                              {formatDate(comment.createdAt) && (
                                <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                                  • {formatDate(comment.createdAt)}
                                </Text>
                              )}
                            </div>
                            {/* Содержимое комментария */}
                            <Paragraph 
                              style={{ margin: 0, color: "#333" }}
                              ellipsis={{ rows: 2, expandable: false }}
                            >
                              {comment.content}
                            </Paragraph>
                          </div>
                        }
                        description={
                          <div style={{ marginTop: 4 }}>
                            {/* Контекст поста */}
                            {comment.post?.content && (
                              <div style={{ 
                                background: "#f5f5f5", 
                                padding: "8px 12px", 
                                borderRadius: 6,
                                marginTop: 8,
                                borderLeft: "3px solid #1677ff"
                              }}>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  In post: 
                                </Text>
                                <Text style={{ fontSize: 12, marginLeft: 4 }}>
                                  {truncateText(comment.post.content, 80)}
                                </Text>
                              </div>
                            )}
                            {/* Дополнительная информация */}
                            <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 4 }}>
                              {typeof comment.likes === 'number' && comment.likes > 0 && (
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  ❤️ {comment.likes}
                                </Text>
                              )}
                            </div>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                  locale={{ emptyText: loading ? <Spin /> : "No comments found" }}
                />
              ),
            },
          ]}
        />
      </div>
    </Modal>
  );
});