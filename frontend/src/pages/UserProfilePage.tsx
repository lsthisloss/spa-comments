import { useParams, useLocation } from "react-router-dom";
import { useEffect, useState, useMemo, useCallback } from "react";
import { Spin, Button, Avatar, Empty, Collapse, message } from "antd";
import { 
  ArrowLeftOutlined, 
  EditOutlined, 
  InboxOutlined, 
  UserAddOutlined, 
  UserDeleteOutlined,
  SettingOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { getAvatarColor } from "../components/ui/particles/avatarColor";
import { observer } from "mobx-react";
import { autorun } from "mobx";
import PostsThread from "../components/posts/PostsThread";
import EditProfileModal from "../components/user/modals/EditProfileModal";
import AvatarModal from "../components/user/modals/AvatarModal";
import UserSettings from "../components/user/UserSettings";
import { logger } from "../utils/Logger";
import AdminBadge from "../components/ui/particles/AdminBadge";
import { User } from "../types/interfaces";
import { useUserStore, usePostStore } from "../hooks/useStore";
import { useNavigationHelper } from "../hooks/useNavigationHelper";

const TABS = [
  { key: "posts", label: "Posts", icon: <InboxOutlined /> },
];

const UserProfilePage = observer(() => {
  // Используем хуки для получения сторов
  const userStore = useUserStore();
  const postStore = usePostStore();
  const navigationHelper = useNavigationHelper();

  const { userId: userIdParam, username: usernameParam } = useParams();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("posts");
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isAvatarModalVisible, setIsAvatarModalVisible] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Определяем что искать
  const searchParam = userIdParam || usernameParam;
  const currentUser = userStore.user;
  
  // Определяем является ли профиль собственным
  const isOwnProfile = !searchParam || 
    searchParam === currentUser?.id || 
    searchParam === currentUser?.slug || 
    searchParam === currentUser?.userName;
  
  // Получаем пользователя для отображения
  const user = isOwnProfile ? currentUser : profileUser;

  // Загрузка пользователя
  useEffect(() => {
    if (!searchParam || isOwnProfile) {
      setProfileUser(null);
      setIsLoading(false);
      return;
    }

    const loadUser = async () => {
      setIsLoading(true);
      try {
        logger.log(`[UserProfilePage] Loading user: ${searchParam}`);
        
        // Сначала проверяем кэш
        const cachedUser = userStore.getCachedUser(searchParam);
        
        if (cachedUser) {
          logger.log(`[UserProfilePage] Found user in cache: ${cachedUser.userName} (${cachedUser.slug})`);
          setProfileUser(cachedUser);
          setIsLoading(false);
          return;
        }
        
        // Загружаем через API
        const loadedUser = await userStore.getUserById(searchParam);
        
        if (loadedUser) {
          logger.log(`[UserProfilePage] Loaded user: ${loadedUser.userName} (${loadedUser.slug})`);
          setProfileUser(loadedUser);
        } else {
          logger.warn(`[UserProfilePage] User not found: ${searchParam}`);
          setProfileUser(null);
        }
      } catch (error) {
        logger.error(`[UserProfilePage] Error loading user ${searchParam}:`, error);
        setProfileUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, [searchParam, isOwnProfile, userStore]);

  // Проверяем подписку
  const isFollowing = useMemo(() => {
    if (isOwnProfile || !user?.id || !currentUser?.following) return false;
    return currentUser.following.some(followedUser => followedUser.id === user.id);
  }, [isOwnProfile, user?.id, currentUser?.following]);

  // Стабильный ID для PostsThread
  const stableUserId = useMemo(() => user?.id, [user?.id]);

  // Ленивая инициализация PostsThread 
  const PostsThreadComponent = useMemo(() => {
    if (activeTab !== "posts" || !stableUserId || isLoading) {
      return null;
    }
    
    return (
      <PostsThread 
        activeTab="user"
        userId={stableUserId}
        key={`user-${stableUserId}`}
      />
    );
  }, [activeTab, stableUserId, isLoading]);

  // Проверяем preserveFeeds для сохранения лент
  useEffect(() => {
    interface LocationState {
      preserveFeeds?: boolean;
    }
    const locationState = location.state as LocationState;
    const shouldPreserveFeeds = locationState?.preserveFeeds;
    
    if (shouldPreserveFeeds) {
      logger.log("[UserProfilePage] Preserving feeds state - not resetting following");
      return;
    }
    
    logger.log("[UserProfilePage] Resetting following feed state");
    postStore.resetFeedsState("following");
  }, [location.state, postStore]);

  // Отслеживаем изменения подписок через MobX
  useEffect(() => {
    if (!currentUser) return;

    let initialFollowingCount = currentUser.following?.length || 0;
    logger.log(`[UserProfilePage] Initial following count: ${initialFollowingCount}`);
    
    const disposer = autorun(() => {
      const currentFollowingCount = currentUser.following?.length || 0;
      
      if (currentFollowingCount !== initialFollowingCount) {
        logger.log(`[UserProfilePage] Following count changed from ${initialFollowingCount} to ${currentFollowingCount}`);
        postStore.markFeedForRefresh("following");
        initialFollowingCount = currentFollowingCount;
        logger.log("[UserProfilePage] Following feed marked for refresh due to subscription changes");
      }
    });
    
    return () => {
      logger.log("[UserProfilePage] Disposing following changes autorun");
      disposer();
    };
  }, [currentUser, postStore]);

  // Мемоизируем вычисления аватара
  const avatarProps = useMemo(() => {
    const letter = user?.userName?.charAt(0).toUpperCase() || "?";
    const color = getAvatarColor(letter);
    return { letter, color };
  }, [user?.userName]);

  // Обработчики
  const handleAvatarSave = useCallback(async (avatarData: { 
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
  }, [userStore]);

// В компоненте UserProfilePage
  const handleGoBack = useCallback(() => {
  navigationHelper.goBack();
}, [navigationHelper]);
  const handleFollow = useCallback(async () => {
    if (!user?.id || followLoading || isOwnProfile) return;
    
    setFollowLoading(true);
    try {
      await userStore.followUser(user.id);
      message.success(`You are now following ${user.userName}`);
    } catch (error) {
      console.error("Failed to follow user:", error);
      message.error("Failed to follow user");
    } finally {
      setFollowLoading(false);
    }
  }, [user?.id, user?.userName, followLoading, isOwnProfile, userStore]);

  const handleUnfollow = useCallback(async () => {
    if (!user?.id || followLoading || isOwnProfile) return;
    
    setFollowLoading(true);
    try {
      await userStore.unfollowUser(user.id);
      message.success(`You unfollowed ${user.userName}`);
    } catch (error) {
      console.error("Failed to unfollow user:", error);
      message.error("Failed to unfollow user");
    } finally {
      setFollowLoading(false);
    }
  }, [user?.id, user?.userName, followLoading, isOwnProfile, userStore]);

  // Рендер состояний
  if (isLoading && !isOwnProfile) {
    return (
      <div className="user-profile__loading">
        <Spin size="large" />
      </div>
    );
  }

  if (!user && !isLoading && !isOwnProfile) {
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
        <Empty 
          description={`User "${searchParam}" not found`} 
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  if (!user && isOwnProfile) {
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
        <Empty 
          description="Please log in to view your profile" 
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  const collapseItems = [
    {
      key: 'settings',
      label: (
        <span className="collapse-label">
          <SettingOutlined />
          Developer Settings
        </span>
      ),
      children: <UserSettings />,
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
                background: avatarProps.color,
                cursor: isOwnProfile ? 'pointer' : 'default'
              }}
              onClick={() => isOwnProfile && setIsAvatarModalVisible(true)}
              aria-label={`Avatar for ${user?.userName || "user"}`}
            >
              {user ? avatarProps.letter : null}
            </Avatar>
          )}
          
          <div className="user-profile__info">
            <div className="user-profile__info-name" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{user?.userName}</span>
              <AdminBadge role={user?.role || 'user'} />
            </div>
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
        <div className="user-profile__settings">
          <Collapse
            items={collapseItems}
            size="small"
            ghost
            expandIconPosition="end"
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
            {tab.icon && <span className="tab-icon">{tab.icon}</span>} 
            {tab.label}
          </div>
        ))}
      </div>

      {PostsThreadComponent}

      {/* Модалки */}
      {isEditModalVisible && isOwnProfile && currentUser && (
        <EditProfileModal
          visible={isEditModalVisible}
          onClose={() => setIsEditModalVisible(false)}
          user={currentUser}
        />
      )}

      {isAvatarModalVisible && isOwnProfile && currentUser && (
        <AvatarModal
          visible={isAvatarModalVisible}
          onClose={() => setIsAvatarModalVisible(false)}
          onSave={handleAvatarSave}
          currentAvatarUrl={currentUser.avatarUrl ?? undefined}
          currentAvatarShape={currentUser.avatarShape || 'circle'}
          userName={currentUser.userName}
        />
      )}
    </div>
  );
});

export default UserProfilePage;