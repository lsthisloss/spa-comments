import { Image as AntImage, Tooltip, Card, Typography } from "antd";
import { getAvatarColor } from "../ui/particles/avatarColor";
import ItemFooter from "./ItemFooter";
import OptimizedText from "../ui/optimization/OptimizedText";
import AdminBadge from "../ui/particles/AdminBadge";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import React from "react";
import { observer } from "mobx-react-lite";
import { Comment as CommentType, Post } from "../../types/interfaces";
import { logger } from "../../utils/Logger";
import { formatDistance } from "date-fns";
import { useUserStore, useCommentStore, usePostStore } from '../../hooks/useStore';
import { useNavigationHelper } from '../../hooks/useNavigationHelper';

const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
/*
  Компонент для предварительной загрузки изображений с улучшенным скелетоном
  Используется для отображения изображений в ленте постов и комментариев
  Предоставляет улучшенный UX при загрузке изображений
*/
const PreloadImage = ({ src, alt, onLoad }: { src: string; alt: string; onLoad: () => void }) => {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const img = new window.Image();
    img.src = src;
    img.onload = () => {
      setLoaded(true);
      onLoad();
    };
    img.onerror = () => {
      setLoaded(true);
      onLoad();
    };
  }, [src, onLoad]);

  return (
    <div className="item-image-container">
      {loaded ? (
        <AntImage
          src={src}
          alt={alt}
          preview={true}
          style={{
            width: '100%',
            height: '120px',
            objectFit: 'cover',
            display: 'block'
          }}
        />
      ) : (
        // Скелетон для изображения
        <div style={{
          height: '120px',
          width: '120px',
          background: 'linear-gradient(90deg, #f5f5f5 25%, #e8e8e8 50%, #f5f5f5 75%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 2s ease-in-out infinite',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#9ca3af',
          fontSize: '14px',
          borderRadius: '8px',
          position: 'relative'
        }}>
          {/* Иконка и текст */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            zIndex: 1
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              backgroundColor: 'rgba(156, 163, 175, 0.3)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px'
            }}>
              📷
            </div>
            <span style={{ fontSize: '12px', fontWeight: '500' }}>Loading...</span>
          </div>

          {/* CSS для shimmer эффекта */}
          <style>{`
            @keyframes shimmer {
              0% {
                background-position: -200% 0;
              }
              100% {
                background-position: 200% 0;
              }
            }
          `}</style>
        </div>
      )}
    </div>
  );
};

/*
  * Типы для элементов ленты
  * Используются для типизации пропсов компонента FeedItem
*/

type FeedItemType = CommentType | Post;

/*
  * Интерфейс для пропсов компонента FeedItem
  * Используется для типизации пропсов, передаваемых в компонент
*/

interface FeedItemProps {
  item: FeedItemType;
  type: "post" | "comment";
  disableShowMore?: boolean;
  onLikeClick?: () => void;
  onShowMore?: () => void;
  expanded?: boolean;
  hideCommentButton?: boolean;
  onClick?: () => void;
  isNewItem?: boolean;
}

// Деструктурируем интерфейс
const FeedItemComponent = ({
  item,
  type,
  disableShowMore,
  onLikeClick,
  expanded = false,
  onShowMore,
  hideCommentButton,
}: FeedItemProps) => {
  const heightCache = useRef<Map<string, number>>(new Map());



  /*
      * Используем MobX store для доступа к данным пользователя и постов
      * Используем хуки для получения состояния и методов из store
      * Используем useState для управления локальным состоянием компонента
  */
  const userStore = useUserStore();
  const commentStore = useCommentStore();
  const navigationHelper = useNavigationHelper();
  // Локальное состояние для управления расширением текста
  const [localExpanded, setLocalExpanded] = useState(expanded);
  // Состояние для отслеживания загрузки изображения
  const [, setImageLoaded] = useState(false);

  /*
    * Проверяем, есть ли у пользователя лайк для данного элемента
    * Используем userStore для получения текущего пользователя
    * Если пользователь не авторизован, возвращаем false
    * Иначе проверяем, есть ли ID пользователя в массиве likedUserIds элемента
  */
  const isLiked = userStore.user?.id ? item.likedUserIds?.includes(userStore.user.id) : false;
  const postStore = usePostStore();

  /*
    * Используем useMemo для вычисления имени пользователя
    * Если у элемента есть объект user с userName, используем его
    * Если есть userName, используем его
    * Иначе возвращаем "Anonymous"
  */
  const userName = useMemo(() => {
    if (item.user && item.user.userName) return item.user.userName;
    if (item.userName) return item.userName;
    return "Anonymous";
  }, [item.user, item.userName]);
  // Используем useMemo для вычисления роли пользователя
  const userRole = useMemo(() => {
    return item.user?.role || 'user';
  }, [item.user?.role]);
  // Используем useMemo для вычисления первой буквы имени пользователя
  const avatarLetter = useMemo(
    () => (userName.charAt(0) || "?").toUpperCase(),
    [userName]
  );


  /*
    * Используем useMemo для вычисления URL изображения
    * Если item.imageUrl не задан, возвращаем null
    * Если URL начинается с http, используем его напрямую
    * Иначе добавляем apiUrl к imageUrl
  */

  const imageUrl = useMemo(() => {
    if (!item.imageUrl) return null;

    const fullUrl = item.imageUrl.startsWith("http")
      ? item.imageUrl
      : `${apiUrl}${item.imageUrl}`;

    return fullUrl;
  }, [item.imageUrl]);

  /*
    * Обработчик загрузки изображения
    * Устанавливает состояние imageLoaded в true
    * Вызывает onShowMore, если он передан
  */

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);

    if (onShowMore) {
      // Даём время на полную загрузку и рендер изображения
      setTimeout(() => {
        onShowMore();
      }, 100);
    }
  }, [onShowMore]);

  /*
    * Обработчик клика по кнопке лайка
    * Вызывает onLikeClick, если он передан
    * Иначе переключает лайк для поста или комментария
  */

  const handleLikeClick = useCallback(() => {
    if (onLikeClick) {
      onLikeClick();
      return;
    }
    const currentUserId = userStore.user?.id;
    if (!currentUserId) {
      logger.warn("User not logged in");
      return;
    }
    if (type === "post") {
      logger.log(`Liking post ${item.id} as user ${currentUserId}`);
      postStore.toggleLike(item.id, currentUserId);
    } else if (type === "comment") {
      logger.log(`Liking comment ${item.id} as user ${currentUserId}`);
      commentStore.toggleLike(item.id, currentUserId);
    }
  }, [onLikeClick, userStore.user?.id, type, item.id, postStore, commentStore]);

  /*
    * Обработчик клика по тексту
    * Переключает состояние локального расширения текста
    * Вызывает onShowMore, если он передан
  */
  const handleTextToggle = useCallback(() => {
    const newExpandedState = !localExpanded;
    setLocalExpanded(newExpandedState);

    // Notify parent component of height change
    if (onShowMore) {
      logger.log(`[FeedItem] Text toggle for item ${item.id}, new state: ${newExpandedState ? 'expanded' : 'collapsed'}`);

      // Ensure force update after expansion/collapse
      setTimeout(() => {
        // Request remeasurement of this item
        window.dispatchEvent(new CustomEvent('remeasureItem', {
          detail: { itemId: item.id }
        }));

        // Call the parent callback
        onShowMore();
      }, 10);
    }
  }, [localExpanded, onShowMore, item.id]);

  /*
    * Форматируем дату создания элемента
    * Используем formatDistanceToNow для отображения времени с момента создания
  */

  // Функция для форматирования времени в "X ago"
  const formatTimeAgo = (date: Date | number | string): string => {
    const now = new Date();
    const parsedDate = new Date(date);

    // Чек на минутный пост для красивой надписи "just now"
    const diffInSeconds = Math.floor((now.getTime() - parsedDate.getTime()) / 1000);
    if (diffInSeconds < 60) {
      return "just now";
    }

    // Получаем полное расстояние во времени
    const fullDistance = formatDistance(parsedDate, now);
    const matches = fullDistance.match(/^(about |)(\d+) (\w+)$/);
    if (!matches) return fullDistance;
    const [, , num, unit] = matches;

    // Создаем короткую версию единицы измерения
    let shortUnit = '';
    switch (unit) {
      case 'second':
      case 'seconds':
        shortUnit = 's';
        break;
      case 'minute':
      case 'minutes':
        shortUnit = 'm';
        break;
      case 'hour':
      case 'hours':
        shortUnit = 'h';
        break;
      case 'day':
      case 'days':
        shortUnit = 'd';
        break;
      case 'month':
      case 'months':
        shortUnit = 'mo';
        break;
      case 'year':
      case 'years':
        shortUnit = 'y';
        break;
      default:
        shortUnit = unit;
    }

    return `${num}${shortUnit} ago`;
  };

  // Then in your component, replace the formattedDate calculation:
  const formattedDate = React.useMemo(() => {
    return formatTimeAgo(item.createdAt);
  }, [item.createdAt]);

  /* 
  * Обработчик клика по имени пользователя
  * Предотвращаем стандартное поведение и навигацию
  * Используем userSlug для навигации к профилю пользователя
  * Логируем действие для отладки
*/

  const handleUsernameClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const userSlug = item.user?.userName || item.userName;
    if (userSlug) {
      logger.log(`[FeedItem] Username clicked for user ${userSlug} (ID: ${item.userId}), using navigation helper`);
      navigationHelper.navigateToProfile(userSlug);
    } else {
      logger.warn(`[FeedItem] No username available for user ${item.userId}`);
    }
  }, [item.user?.userName, item.userName, item.userId, navigationHelper]);

  /*
    * Обработчик изменения высоты текстового контента
    * Вызывается при изменении высоты текстового блока
    * Логируем новое значение высоты для отладки
    * Диспатчим событие для глобального уведомления о изменении высоты
    * Вызываем onShowMore, если он передан
  */

  const handleTextResize = useCallback((height: number) => {
    // Агрессивное кэширование и throttling
    const cachedHeight = heightCache.current.get(item.id);

    // Игнорируем мелкие изменения
    if (cachedHeight && Math.abs(cachedHeight - height) < 3) {
      return;
    }

    // Обновляем кэш высоты
    heightCache.current.set(item.id, height);

    //logger.log(`[FeedItem] Text content height changed to ${height}px for item ${item.id}`);

    /*
      * Если передан onShowMore, устанавливаем таймер для обработки изменения высоты
      * Используем throttle для предотвращения частых вызовов
      * Увеличиваем задержку для стабильности и предотвращения мерцания
    */
    if (onShowMore) {
      const windowWithThrottle = window as Window & {
        heightChangeThrottle?: boolean;
        heightChangeTimeouts?: Map<string, NodeJS.Timeout>;
      };

      if (!windowWithThrottle.heightChangeTimeouts) {
        windowWithThrottle.heightChangeTimeouts = new Map();
      }

      // Очищаем предыдущий таймер для этого элемента
      const existingTimeout = windowWithThrottle.heightChangeTimeouts.get(item.id);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Таймер для обработки изменения высоты
      const timeoutId = setTimeout(() => {
        if (!windowWithThrottle.heightChangeThrottle) {
          windowWithThrottle.heightChangeThrottle = true;

          // Диспатчим событие
          window.dispatchEvent(new CustomEvent('heightChanged', {
            bubbles: true,
            detail: { itemId: item.id, height: height }
          }));

          onShowMore();

          // Сбрасываем throttle через увеличенную задержку
          setTimeout(() => {
            windowWithThrottle.heightChangeThrottle = false;
          }, 100);
        }

        windowWithThrottle.heightChangeTimeouts?.delete(item.id);
      }, 50);

      windowWithThrottle.heightChangeTimeouts.set(item.id, timeoutId);
    }
  }, [item.id, onShowMore]);
  const handleAvatarClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.user?.userName || item.userName) {
      const userSlug = item.user?.userName || item.userName;
      logger.log(`[FeedItem] Avatar clicked for user ${userSlug} (ID: ${item.user?.id})`);
      navigationHelper.navigateToProfile(userSlug);
    }
  }, [item.user?.userName, item.userName, item.user?.id, navigationHelper]);

  /** Возвращаем JSX для отображения элемента ленты
    * Используем Card из Ant Design для обертки
    * Используем классы для стилизации в зависимости от типа элемента
    * Отображаем аватар, имя пользователя, дату и контент
    * Если есть изображение, отображаем его
    * Отображаем футер с кнопками лайка и комментариев
  */

  return (
    <Card
      className={`${type}-item fade-in`}
      variant="borderless"
      style={{ cursor: "default" }}
    >
      <div className="item-layout" data-id={item.id}>
        {/* Аватар */}
        {item.user?.avatarUrl ? (
          <div
            className="item-avatar"
            style={{ cursor: "pointer" }}
            onClick={handleAvatarClick}
          >
            <img
              src={item.user.avatarUrl}
              alt={`${userName}'s avatar`}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                borderRadius: item.user.avatarShape === "square" ? "4px" : "50%",
              }}
            />
          </div>
        ) : (
          <div
            className="item-avatar"
            style={{
              background: getAvatarColor(avatarLetter),
              borderRadius: item.user?.avatarShape === "square" ? "4px" : "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
            onClick={handleAvatarClick}
          >
            {avatarLetter}
          </div>
        )}

        <div className="item-content">
          <div className="item-user-info">
            <Typography.Text
              strong
              className="clickable-username"
              style={{
                cursor: "pointer",
                transition: "color 0.2s ease",
              }}
              onClick={handleUsernameClick}
            >
              {userName}
            </Typography.Text>
            <AdminBadge role={userRole} />
            <span className="item-separator">·</span>
            <Tooltip title={new Date(item.createdAt).toLocaleString()}>
              <span className="item-date">{formattedDate}</span>
            </Tooltip>
          </div>

          {!disableShowMore ? (
            <OptimizedText
              content={item.content}
              maxLength={250}
              expanded={localExpanded}
              onToggle={handleTextToggle}
              className="item-text"
              onResize={handleTextResize}
            />
          ) : (
            <div
              className="item-text expanded"
              style={{
                contain: "layout style",
                wordBreak: "break-word",
                overflowWrap: "break-word",
                whiteSpace: "pre-wrap",
              }}
              dangerouslySetInnerHTML={{
                __html: item.content.replace(/\n/g, "<br/>"),
              }}
            />
          )}

          {/* Изображение */}
          {imageUrl && (
            <PreloadImage
              src={imageUrl}
              alt={`Image attached to post ${item.id}`}
              onLoad={handleImageLoad}
            />
          )}

          <ItemFooter
            item={item}
            type={type}
            onLikeClick={(e) => {
              e.stopPropagation();
              handleLikeClick();
            }}
            isLiked={isLiked}
            hideCommentButton={hideCommentButton}
          />
        </div>
      </div>
    </Card>
  );
}

const FeedItem = observer(FeedItemComponent);
export default FeedItem;