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
  // Stores
  const userStore = useUserStore();
  const postStore = usePostStore();
  const navigationHelper = useNavigationHelper();

  // Get username and userId from URL params
  const { username: usernameParam, userId: userIdParam } = useParams<{ username?: string; userId?: string }>();
  const userSlug = usernameParam;
  const location = useLocation();

  // State
  const [activeTab, setActiveTab] = useState("posts");
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isAvatarModalVisible, setIsAvatarModalVisible] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const currentUser = userStore.user;
  const searchParam = userIdParam || usernameParam;
  // Determine if this is own profile
  const isOwnProfile = !userSlug || 
    userSlug === currentUser?.userName || 
    userSlug === currentUser?.slug;
  
  // Get user for display
  const user = isOwnProfile ? currentUser : profileUser;

  // Load user effect
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

  // Check if following
  const isFollowing = useMemo(() => {
    if (isOwnProfile || !user?.id || !currentUser?.following) return false;
    return currentUser.following.some(followedUser => followedUser.id === user.id);
  }, [isOwnProfile, user?.id, currentUser?.following]);

  // Stable user ID for PostsThread
  const stableUserId = useMemo(() => user?.id, [user?.id]);

  // Lazy PostsThread initialization 
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

  // Preserve feeds effect
  useEffect(() => {
    interface LocationState {
      preserveFeeds?: boolean;
      skipFetch?: boolean;
    }
    const locationState = location.state as LocationState;
    const shouldPreserveFeeds = locationState?.preserveFeeds;
    const shouldSkipFetch = locationState?.skipFetch;
    
    // Don't reset if we're preserving feeds or skipping fetch
    if (shouldPreserveFeeds || shouldSkipFetch) {
      logger.log(`[UserProfilePage] Preserving feeds state - not resetting following (preserveFeeds: ${shouldPreserveFeeds}, skipFetch: ${shouldSkipFetch})`);
      return;
    }
    
    // Only reset following feed if it's actually necessary
    const currentFollowingFeed = postStore.getFeed('following');
    const isStale = currentFollowingFeed.reset || currentFollowingFeed.list.length === 0;
    
    if (isStale) {
      logger.log("[UserProfilePage] Following feed is stale, resetting");
      postStore.resetFeedsState("following");
    } else {
      logger.log("[UserProfilePage] Following feed is fresh, keeping cached data");
    }
  }, [location.state, postStore]);

  // Track following changes through MobX
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

  // Memoize avatar calculations
  const avatarProps = useMemo(() => {
    const letter = user?.userName?.charAt(0).toUpperCase() || "?";
    const color = getAvatarColor(letter);
    return { letter, color };
  }, [user?.userName]);

  // Handlers
  // ...existing code...

// Handlers
const handleAvatarSave = useCallback(async (avatarData: { 
  type: 'upload' | 'initial', 
  value: string, 
  file?: File,
  shape: 'circle' | 'square'
}) => {
  try {
    console.log('[UserProfilePage] Starting avatar save:', avatarData);
    const result = await userStore.updateAvatar(avatarData);
    console.log('[UserProfilePage] Avatar save result:', result);
    
    if (result) {
      message.success('Avatar updated successfully');
      // Принудительное обновление компонента если нужно
      setIsAvatarModalVisible(false);
    }
  } catch (error) {
    console.error('[UserProfilePage] Avatar save error:', error);
    message.error('Failed to update avatar');
  }
}, [userStore]);


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

  // Render loading state
  if (isLoading && !isOwnProfile) {
    return (
      <div className="user-profile__loading">
        <Spin size="large" />
      </div>
    );
  }

  // Render user not found
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
          description={`User "${userSlug}" not found`} 
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  // Render not logged in
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
          {user?.avatarUrl ? ( // Render avatar with URL
            <Avatar
              size={96}
              src={user.avatarUrl}
              shape={user.avatarShape as 'circle' | 'square' || 'circle'}
              className="user-profile__avatar"
              style={{ cursor: isOwnProfile ? 'pointer' : 'default' }}
              onClick={() => isOwnProfile && setIsAvatarModalVisible(true)}
              aria-label={`Avatar for ${user?.userName || "user"}`}
            />
          ) : ( // Render avatar with letter and color
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