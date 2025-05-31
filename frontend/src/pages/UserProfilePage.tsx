import { useParams, useNavigate, useLocation } from "react-router-dom";
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
import userStore from "../services/stores/UserStore";
import { postStore } from "../services/stores/PostStore";
import PostsThread from "../components/posts/PostsThread";
import EditProfileModal from "../components/user/modals/EditProfileModal";
import AvatarModal from "../components/user/modals/AvatarModal";
import UserSettings from "../components/user/UserSettings";
import { navigationStore } from "../services/stores/NavigationStore";
import { logger } from "../utils/Logger";

const TABS = [
  { key: "posts", label: "Posts", icon: <InboxOutlined /> },
];

const UserProfilePage = observer(() => {
  const { userId: userIdParam } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("posts");
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isAvatarModalVisible, setIsAvatarModalVisible] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  
  // Используем UserStore как единый источник правды
  const currentUser = userStore.user;
  
  // Определяем эффективный userId
  const effectiveUserId = userIdParam || currentUser?.id || currentUser?.slug;
  
  // Получаем пользователя по UUID или slug
  const user = effectiveUserId ? userStore.getCachedUser(effectiveUserId) : currentUser;
  const isLoading = effectiveUserId ? userStore.isUserLoading(effectiveUserId) : false;
  
  const isOwnProfile = currentUser && user && currentUser.id === user.id;
  const isFollowing = user?.id && !isOwnProfile ? userStore.isFollowing(user.id) : false;

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
    
    // Сбрасываем ленту подписок только если НЕ сохраняем состояние
    logger.log("[UserProfilePage] Resetting following feed state");
    postStore.resetFeedState("following");
  }, [location.state]);

  // ЭЛЕГАНТНЫЙ ПОДХОД: Отслеживаем изменения подписок через MobX
  useEffect(() => {
    if (!currentUser) return;

    // Сохраняем начальное количество подписок
    let initialFollowingCount = currentUser.following?.length || 0;
    
    logger.log(`[UserProfilePage] Initial following count: ${initialFollowingCount}`);
    
    // Используем MobX autorun для автоматического отслеживания изменений
    const disposer = autorun(() => {
      const currentFollowingCount = currentUser.following?.length || 0;
      
      // При изменении количества подписок помечаем following ленту для обновления
      if (currentFollowingCount !== initialFollowingCount) {
        logger.log(`[UserProfilePage] Following count changed from ${initialFollowingCount} to ${currentFollowingCount}`);
        
        // Помечаем following ленту для обновления при следующей загрузке
        postStore.markFeedForRefresh("following");
        
        // Обновляем счетчик
        initialFollowingCount = currentFollowingCount;
        
        logger.log("[UserProfilePage] Following feed marked for refresh due to subscription changes");
      }
    });
    
    // Cleanup при размонтировании компонента
    return () => {
      logger.log("[UserProfilePage] Disposing following changes autorun");
      disposer();
    };
  }, [currentUser?.id]);

  // Мемоизируем вычисления аватара
  const avatarProps = useMemo(() => {
    const letter = user?.userName?.charAt(0).toUpperCase() || "?";
    const color = getAvatarColor(letter);
    return { letter, color };
  }, [user?.userName]);

  // Обработчик для сохранения аватарки
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
  }, []);

  // Загружаем данные пользователя через UserStore
  useEffect(() => {
    if (!userIdParam) {
      console.log('[UserProfilePage] Own profile, using current user');
      return;
    }
    
    if (!user && !isLoading && effectiveUserId) {
      console.log(`[UserProfilePage] Loading user: ${effectiveUserId}`);
      userStore.getUserById(effectiveUserId);
    }
  }, [userIdParam, effectiveUserId, user, isLoading]);

  const handleGoBack = useCallback(() => {
    if (navigationStore.currentState.fromFeed || navigationStore.currentState.fromFollowing) {
      navigationStore.handleBackNavigation(navigate);
      setTimeout(() => {
        navigationStore.clearCurrentState();
      }, 100);
    } else {
      navigate(-1);
    }
  }, [navigate]);

  // Оптимизированные обработчики follow/unfollow
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
  }, [user?.id, user?.userName, followLoading, isOwnProfile]);

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
  }, [user?.id, user?.userName, followLoading, isOwnProfile]);

  // Показать загрузку только если это не собственный профиль
  if (isLoading && userIdParam) {
    return (
      <div className="user-profile__loading">
        <Spin size="large" />
      </div>
    );
  }

  // Показать ошибку только если пользователь не найден И это не собственный профиль
  if (!user && !isLoading && userIdParam) {
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

  // Если нет пользователя вообще (не залогинен)
  if (!user) {
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
        <Empty description="Please log in to view profile" />
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

        {activeTab === "posts" && user?.id && (
          <PostsThread 
            activeTab="user"
            userId={user.id}
          />
        )}
        {activeTab === "comments" && (
          <span>In development</span>
        )}

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