import { useNavigate, useParams } from "react-router-dom";
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
import PostsThread from "../components/posts/PostsThread";
import EditProfileModal from "../components/user/modals/EditProfileModal";
import AvatarModal from "../components/user/modals/AvatarModal";
import UserSettings from "../components/user/UserSettings";
import { logger } from "../utils/Logger";
import AdminBadge from "../components/ui/particles/AdminBadge";
import { User } from "../types/interfaces";
import { useUserStore } from "../hooks/useStore";

const TABS = [
  { key: "posts", label: "Posts", icon: <InboxOutlined /> },
];

/*
  Страница профиля пользователя.
  Отображает информацию о пользователе, его посты и настройки.
  Позволяет редактировать профиль и управлять аватаром.
*/
const UserProfilePage = observer(() => {
  const userStore = useUserStore();
  const navigate = useNavigate();
  const { username: usernameParam, userId: userIdParam } = useParams<{ username?: string; userId?: string }>();
  const userSlug = usernameParam;
  const [profileUser, setProfileUser] = useState<User | null>(null); // Профиль пользователя, который загружается по слагу или ID
  const [activeTab, setActiveTab] = useState("posts"); // Активная вкладка профиля

  const [isEditModalVisible, setIsEditModalVisible] = useState(false); // Модальное окно редактирования профиля
  const [isAvatarModalVisible, setIsAvatarModalVisible] = useState(false); // Модальное окно изменения аватара
  const [followLoading, setFollowLoading] = useState(false); // Состояние загрузки при подписке/отписке
  const currentUser = userStore.user; // Текущий пользователь из MobX хранилища
  const isOwnProfile = !userSlug ||
    userSlug === currentUser?.userName ||
    userSlug === currentUser?.slug; // Проверяем, является ли профиль текущим пользователем

  const user = isOwnProfile ? currentUser : profileUser;
  const searchParam = userIdParam || usernameParam;
  const stableUserId = useMemo(() => user?.id, [user?.id]);

  const [isLoading, setIsLoading] = useState(!isOwnProfile); // true для внешних профилей

  // Флаг загрузки профиля пользователя
  const handleGoBack = useCallback(() => {
    logger.log(`[UserProfilePage] Navigating back from profile: ${userSlug}`);
    navigate(-1);
  }, [navigate, userSlug]);

  // Проверяем, является ли профиль текущим пользователем
  const isFollowing = useMemo(() => {
    if (isOwnProfile || !user?.id || !currentUser?.following) return false;
    return currentUser.following.some((followedUser: User) => followedUser.id === user.id);
  }, [isOwnProfile, user?.id, currentUser?.following]);

  // Мемоизируем компонент потока постов для оптимизации
  const PostsThreadComponent = useMemo(() => {
    if (activeTab !== "posts" || !stableUserId) {
      return null;
    }

    return (
      <PostsThread
        activeTab="user"
        userId={stableUserId}
        key={`user-${stableUserId}`}
      />
    );
  }, [activeTab, stableUserId]);

  // Мемоизируем компонент потока постов для оптимизации
  const avatarProps = useMemo(() => {
    const letter = user?.userName?.charAt(0).toUpperCase() || "?";
    const color = getAvatarColor(letter);
    return { letter, color };
  }, [user?.userName]);

  // Обработчик для изменения аватара
  const handleAvatarSave = useCallback(async (avatarData: {
    type: 'upload' | 'initial',
    value: string,
    file?: File,
    shape: 'circle' | 'square'
  }) => {
    try {
      const result = await userStore.updateAvatar(avatarData);
      if (result) {
        message.success('Avatar updated successfully');
        setIsAvatarModalVisible(false);
      }
    } catch (error) {
      console.error('[UserProfilePage] Avatar save error:', error);
      message.error('Failed to update avatar');
    }
  }, [userStore]);

  // Обработчики подписки и отписки
  const handleFollow = useCallback(async () => {
    if (!user?.id || followLoading || isOwnProfile) return;
    setFollowLoading(true);
    try {
      await userStore.followUser(user.id);
      message.success(`You are now following ${user.userName}`);
    } catch (error) {
      message.error(`Failed to follow user ${error}`);
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
      message.error(`Failed to unfollow user ${error}`);
    } finally {
      setFollowLoading(false);
    }
  }, [user?.id, user?.userName, followLoading, isOwnProfile, userStore]);

  /*
    Эффект для загрузки профиля пользователя по слагу или ID.
    Если профиль текущего пользователя, то данные уже есть в userStore.
    Если это внешний профиль, загружаем его из API или кэша.
  */
  useEffect(() => {
    if (!searchParam || isOwnProfile) {
      setProfileUser(null);
      setIsLoading(false);
      return;
    }

    const loadUser = async () => {
      try {
        logger.log(`[UserProfilePage] Loading user: ${searchParam}`);

        const cachedUser = userStore.getCachedUser(searchParam);
        if (cachedUser) {
          logger.log(`[UserProfilePage] Found user in cache: ${cachedUser.userName}`);
          setProfileUser(cachedUser);

          // Check if URL needs to be updated (username changed)
          if (usernameParam && usernameParam !== cachedUser.slug) {
            logger.log(`[UserProfilePage] Username changed, redirecting to new URL: ${cachedUser.slug}`);
            navigate(`/user/${cachedUser.slug}`, { replace: true });
          }

          setIsLoading(false);
          return;
        }

        const loadedUser = await userStore.getUserById(searchParam);
        if (loadedUser) {
          logger.log(`[UserProfilePage] Loaded user: ${loadedUser.userName}`);
          setProfileUser(loadedUser);

          // Also check here if URL needs to be updated
          if (usernameParam && usernameParam !== loadedUser.slug) {
            logger.log(`[UserProfilePage] Username changed, redirecting to new URL: ${loadedUser.slug}`);
            navigate(`/user/${loadedUser.slug}`, { replace: true });
          }
        } else {
          // Try to fetch by user ID as a fallback
          if (!isUUID(searchParam) && currentUser) {
            const userById = await userStore.getUserById(currentUser.id);
            if (userById) {
              setProfileUser(userById);
              navigate(`/user/${userById.slug}`, { replace: true });
              return;
            }
          }

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

      {isLoading ? (
        <div className="user-profile__loading">
          <Spin size="large" />
          <div style={{ marginTop: '16px', textAlign: 'center', color: '#666' }}>
            Loading user profile...
          </div>
        </div>
      ) : !user ? (
        <Empty
          description={
            isOwnProfile
              ? "Please log in to view your profile"
              : `User "${userSlug}" not found`
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <>
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
                  icon={<UserOutlined />}
                  shape={user?.avatarShape as 'circle' | 'square' || 'circle'}
                  className="user-profile__avatar"
                  style={{
                    background: avatarProps.color,
                    cursor: isOwnProfile ? 'pointer' : 'default'
                  }}
                  onClick={() => isOwnProfile && setIsAvatarModalVisible(true)}
                  aria-label={`Avatar for ${user?.userName || "user"}`}
                >
                  {avatarProps.letter}
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
                items={[{
                  key: 'settings',
                  label: (
                    <span className="collapse-label">
                      <SettingOutlined />
                      Developer Settings
                    </span>
                  ),
                  children: <UserSettings />,
                }]}
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
        </>
      )}

      {/* Modals */}
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

function isUUID(searchParam: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(searchParam);
}
