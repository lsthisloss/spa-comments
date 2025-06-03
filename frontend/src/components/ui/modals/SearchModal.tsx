import { useEffect, useRef, useState } from "react";
import { Modal, Input, Tabs, List, Avatar, Spin, Typography } from "antd";
import { UserOutlined, MessageOutlined, InboxOutlined } from "@ant-design/icons";
import { observer } from "mobx-react-lite";
import { useNavigate } from "react-router-dom";
import { useSocketStore } from "../../../hooks/useStore";


const { Text } = Typography;

export const SearchModal = observer(function SearchModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  type SearchResults = {
    users: { userName: string; email: string; avatarUrl?: string; slug?: string; avatarShape?: string }[];
    posts: { title?: string; content?: string; slug?: string; author?: { userName: string; avatarUrl?: string; slug?: string; avatarShape?: string } }[];
    comments: { text?: string; slug?: string; author?: { userName: string; avatarUrl?: string; slug?: string; avatarShape?: string } }[];
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

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      footer={null}
      width={600}
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
              label: <><UserOutlined /> Users</>,
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
                        title={user.userName}
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
              label: <><InboxOutlined /> Posts</>,
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
                        title={post.title || post.content?.slice(0, 40)}
                        description={
                          post.author?.userName && post.author?.slug ? (
                            <span
                              style={{ color: "#1677ff", cursor: "pointer" }}
                              onClick={e => {
                                e.stopPropagation();
                                navigate(`/profile/${post.author?.slug}`);
                              }}
                            >
                              {post.author.userName}
                            </span>
                          ) : (
                            <Text type="secondary">{post.author?.userName}</Text>
                          )
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
              label: <><MessageOutlined /> Comments</>,
              children: (
                <List
                  loading={loading}
                  dataSource={results.comments}
                  renderItem={comment => (
                    <List.Item
                      style={{ cursor: comment.slug ? "pointer" : "default" }}
                      onClick={() => comment.slug && navigate(`/comment/${comment.slug}`)}
                    >
                      <List.Item.Meta
                        avatar={renderAvatar(comment.author?.avatarUrl)}
                        title={comment.text?.slice(0, 40)}
                        description={
                          comment.author?.userName && comment.author?.slug ? (
                            <span
                              style={{ color: "#1677ff", cursor: "pointer" }}
                              onClick={e => {
                                e.stopPropagation();
                                navigate(`/profile/${comment.author?.slug}`);
                              }}
                            >
                              {comment.author.userName}
                            </span>
                          ) : (
                            <Text type="secondary">{comment.author?.userName}</Text>
                          )
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