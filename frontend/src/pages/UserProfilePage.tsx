import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Spin, Button, Avatar, Empty, Collapse, message } from "antd";
import { 
  ArrowLeftOutlined, 
  EditOutlined, 
  InboxOutlined, 
  MessageOutlined, 
  UserAddOutlined, 
  UserDeleteOutlined,
  SettingOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { getAvatarColor } from "../components/ui/particles/avatarColor";
import { observer } from "mobx-react";
import userStore from "../services/stores/UserStore";
import PostsThread from "../components/posts/PostsThread";
import EditProfileModal from "../components/user/modals/EditProfileModal";
import AvatarModal from "../components/user/modals/AvatarModal";
import UserSettings from "../components/user/UserSettings";


const TABS = [
  { key: "posts", label: "Posts", icon: <InboxOutlined /> },
  { key: "comments", label: "Comments", icon: <MessageOutlined /> },
];

const UserProfilePage = observer(() => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("posts");
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isAvatarModalVisible, setIsAvatarModalVisible] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  // Используем UserStore как единый источник правды
  const currentUser = userStore.user;
  const user = userId ? userStore.getCachedUser(userId) : null;
  const isLoading = userId ? userStore.isUserLoading(userId) : false;
  const isOwnProfile = currentUser && (currentUser.id === user?.id || currentUser.id === userId);
  const isFollowing = userId ? userStore.isFollowing(userId) : false;

  const avatarLetter = user?.userName?.charAt(0).toUpperCase() || "?";
  const avatarColor = getAvatarColor(avatarLetter);

  // Обработчик для сохранения аватарки
  const handleAvatarSave = async (avatarData: { 
    type: 'upload' | 'initial', 
    value: string, 
    file?: File,
    shape: 'circle' | 'square'
  }) => {
    try {
      await userStore.updateAvatar(avatarData);
      message.success('Avatar updated successfully');
    } catch (error) {
      message.error('Failed to update avatar');
      console.error(error);
    }
  };

  // Загружаем данные пользователя через UserStore
  useEffect(() => {
    if (userId && !user && !isLoading) {
      userStore.getUserById(userId);
    }
  }, [userId, user, isLoading]);

  const handleGoBack = () => {
    // Проверяем, есть ли история навигации
    if (window.history.length > 1) {
      // Если пришли по прямой ссылке или из внешнего источника
      const referrer = document.referrer;
      if (!referrer || !referrer.includes(window.location.origin)) {
        navigate('/');
      } else {
        navigate(-1);
      }
    } else {
      // Если нет истории, идем на главную
      navigate('/');
    }
  };

  const handleFollow = async () => {
    if (!userId) return;
    setFollowLoading(true);
    try {
      await userStore.followUser(userId);
    } catch (error) {
      console.error("Failed to follow user:", error);
    }
    setFollowLoading(false);
  };

  const handleUnfollow = async () => {
    if (!userId) return;
    setFollowLoading(true);
    try {
      await userStore.unfollowUser(userId);
    } catch (error) {
      console.error("Failed to unfollow user:", error);
    }
    setFollowLoading(false);
  };

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 300 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!user && !isLoading) {
    return (
      <div className="user-profile">
        <div className="user-profile__header">
          <Button
            type="default"
            icon={<ArrowLeftOutlined />}
            onClick={handleGoBack}
            className="user-profile__back-button"
          >
            Back
          </Button>
        </div>
        <Empty description="User not found" />
      </div>
    );
  }

  const collapseItems = [
    {
      key: 'settings',
      label: (
        <span style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          fontWeight: 500,
          color: '#595959'
        }}>
          <SettingOutlined style={{ color: '#1890ff' }} />
          Developer Settings
        </span>
      ),
      children: <UserSettings />,
      style: {
        backgroundColor: '#fafafa',
        borderRadius: '8px',
        border: '1px solid #f0f0f0',
        marginBottom: '8px'
      }
    }
  ];

   return (
    <div className="user-profile">
      <div className="user-profile__header">
        <Button
          type="default"
          icon={<ArrowLeftOutlined />}
          onClick={handleGoBack}
          className="user-profile__back-button"
        >
          Back
        </Button>
      </div>
      
      <div className="user-profile__card">
        <div className="user-profile__profile-container">
          {user?.avatarUrl ? (
            <Avatar
              size={96}
              src={user.avatarUrl}
              shape={user.avatarShape as 'circle' | 'square' || 'circle'}
              className="user-profile__avatar"
              style={{ cursor: isOwnProfile ? 'pointer' : 'default' }}
              onClick={() => isOwnProfile && setIsAvatarModalVisible(true)}
              aria-label={`Avatar for ${user?.userName || "user"}`}
            />
          ) : (
            <Avatar
              size={96}
              icon={user ? null : <UserOutlined />}
              shape={user?.avatarShape as 'circle' | 'square' || 'circle'}
              className="user-profile__avatar"
              style={{ 
                background: avatarColor,
                cursor: isOwnProfile ? 'pointer' : 'default'
              }}
              onClick={() => isOwnProfile && setIsAvatarModalVisible(true)}
              aria-label={`Avatar for ${user?.userName || "user"}`}
            >
              {user ? avatarLetter : null}
            </Avatar>
          )}
          <div className="user-profile__info">
            <div className="user-profile__info-name">{user?.userName}</div>
            <div className="user-profile__info-email">{user?.email}</div>
            
            <div className="user-profile__buttons">
              {!isOwnProfile && (
                isFollowing ? (
                  <Button
                    className="user-profile__edit-button"
                    type="default"
                    icon={<UserDeleteOutlined />}
                    loading={followLoading}
                    onClick={handleUnfollow}
                  >
                    Unfollow
                  </Button>
                ) : (
                  <Button
                    className="user-profile__edit-button"
                    type="primary"
                    icon={<UserAddOutlined />}
                    loading={followLoading}
                    onClick={handleFollow}
                  >
                    Follow
                  </Button>
                )
              )}
              
              {isOwnProfile && (
                <Button
                  className="user-profile__edit-button scale-in"
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={() => setIsEditModalVisible(true)}
                  aria-label="Edit profile"
                >
                  Edit profile
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {isOwnProfile && (
        <div style={{ marginBottom: '16px' }}>
          <Collapse
            items={collapseItems}
            size="small"
            ghost
            expandIconPosition="end"
            style={{
              backgroundColor: 'transparent',
            }}
          />
        </div>
      )}

      <div className="user-profile__tabs" role="tablist" aria-label="Profile content tabs">
        {TABS.map(tab => (
          <div
            key={tab.key}
            className={`tab${activeTab === tab.key ? " active-tab" : ""}`}
            onClick={() => setActiveTab(tab.key)}
            role="tab"
            aria-selected={activeTab === tab.key}
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && setActiveTab(tab.key)}
          >
            {tab.icon && <span className="tab-icon">{tab.icon}</span>} {tab.label}
          </div>
        ))}
      </div>

      <div className="user-profile__content">
        {activeTab === "posts" && userId && (
          <PostsThread 
            activeTab="user"
            userId={userId}
          />
        )}
        {activeTab === "comments" && (
          <span>In development</span>
        )}
      </div>

      {isEditModalVisible && userStore.user && (
        <EditProfileModal
          visible={isEditModalVisible}
          onClose={() => setIsEditModalVisible(false)}
          user={userStore.user}
        />
      )}

      
      {isAvatarModalVisible && isOwnProfile && currentUser && (
        <AvatarModal
          visible={isAvatarModalVisible}
          onClose={() => setIsAvatarModalVisible(false)}
          onSave={handleAvatarSave}
          currentAvatarUrl={currentUser.avatarUrl}
          currentAvatarShape={currentUser.avatarShape || 'circle'}
          userName={currentUser.userName}
        />
      )}

      {isEditModalVisible && userStore.user && (
        <EditProfileModal
          visible={isEditModalVisible}
          onClose={() => setIsEditModalVisible(false)}
          user={userStore.user}
        />
      )}
    </div>
  );
});

export default UserProfilePage;