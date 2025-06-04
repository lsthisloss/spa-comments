# 🚀 Jeez! - TypeScript Fullstack Social Platform

<div align="center">

**Современная социальная платформа в реальном времени с интеллектуальными лентами, системой ролей и продвинутой архитектурой**

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![RabbitMQ](https://img.shields.io/badge/RabbitMQ-FF6600?style=for-the-badge&logo=rabbitmq&logoColor=white)
![WebSocket](https://img.shields.io/badge/Socket.io-black?style=for-the-badge&logo=socket.io&badgeColor=010101)

</div>

---

## 🌟 О проекте

- 📱 **Посты и комментарии** с неограниченной вложенностью
- 👥 **Система подписок** - следи за интересными пользователями  
- 🔍 **Глобальный поиск** по постам, комментариям и пользователям
- 👑 **Трёхуровневая система ролей** с админ-панелью и визуальными бейджами
- ⚡ **Real-time** обновления всего контента
- 📊 **Интеллектуальные ленты** - All/Following/User с умным кэшированием
- 🎯 **Optimistic UI** - мгновенные лайки и реакции
- 🔐 **Безопасность** - JWT авторизация + CAPTCHA защита + защита сессий
- 📈 **Мониторинг очередей** - контроль производительности и автоматические алерты

---

## 🌟 Возможности социальной платформы

- **📝 Публикация контента**: Создание постов с медиа-файлами и форматированием
- **💬 Социальное взаимодействие**: Комментарии, лайки, подписки на пользователей
- **📰 Персонализированные ленты**: All, Following, User профили с сохранением состояния
- **🔍 Умный поиск**: Elasticsearch для мгновенного поиска контента и людей
- **👤 Профили пользователей**: Персональные страницы с постами и статистикой
- **🛡️ Модерация**: Система ролей user/admin/superadmin с правами управления и бейджами
- **📱 Responsive UI**: Адаптивный дизайн для всех устройств
- **⚡ Производительность**: Virtual scrolling для больших объемов данных

---

## 🏗️ Архитектура

### Backend: Gateway → Queue → Consumer Pattern

<details>
<summary><strong>🔧 Трёхуровневая обработка</strong></summary>

**Gateway** - принимает запросы, мгновенный ответ клиенту  
**Queue** - гарантированная доставка, горизонтальное масштабирование  
**Consumer** - обработка + синхронизация всех клиентов через `server.emit()`

**Результат:** UX без задержек + консистентность данных

</details>

<details>
<summary><strong>🛡️ WebSocket Namespaces</strong></summary>

- `/users` - Управление пользователями, аутентификация  
- `/posts` - Операции с постами, управление лентами  
- `/comments` - Комментарии, вложенные ответы  
- `/search` - Полнотекстовый поиск  

**JWT Guard** проверяет токены при подключении, сохраняет данные в `client.data`

</details>

<details>
<summary><strong>📊 Queue Management & Monitoring</strong></summary>

**Умное управление очередями RabbitMQ:**
- **TTL сообщений**: автоудаление через 5 минут для предотвращения переполнения
- **Ограничения очередей**: максимум 5000 сообщений или 50MB на очередь
- **Lazy queues**: экономия памяти с записью на диск при необходимости
- **Приоритеты сообщений**: комментарии обрабатываются быстрее постов

**Real-time мониторинг:**
- **Автоматические алерты** при превышении 1000/3000 сообщений
- **Memory watermark**: ограничение использования памяти на 60%
- **Queue statistics API** для мониторинга состояния системы
- **Emergency cleanup** при критической нагрузке

**API endpoints для мониторинга:**
```bash
# Проверка статуса очередей
curl http://localhost:3001/api/monitoring/queue-status

# Здоровье системы
curl http://localhost:3001/api/monitoring/health
```

</details>

### Frontend: Реактивность + Производительность

<details>
<summary><strong>⚡ MobX State Management</strong></summary>

- **Strict Mode** с атомарными транзакциями через `runInAction`
- **Observer components** - автоматический ре-рендер только затронутых компонентов
- **Predictable updates** - все изменения в одной транзакции

</details>

<details>
<summary><strong>🏭 Dependency Injection & Singleton Registry</strong></summary>

- **Singleton Registry Pattern** - централизованная регистрация сторов через `createStores()`
- **Dependency Injection** - инъекция зависимостей через конструкторы вместо прямых импортов
- **React Hooks API** - типобезопасные хуки `useUserStore()`, `usePostStore()` и т.д.

**Решаемые проблемы:**
- ✅ Устранение циклических зависимостей между сторами
- ✅ Повышение тестируемости с возможностью подмены зависимостей
- ✅ Более чистая архитектура с явным описанием зависимостей
- ✅ Лучшая поддержка Tree Shaking и оптимизация сборки

**Реализация:**

```typescript
// Создание сторов с правильными зависимостями
export function createStores(): Stores {
  const authStore = new AuthStore();
  
  // Разрыв циклических зависимостей через заглушки
  const tempUserStore = {} as UserStore;
  const socketStore = new SocketStore(authStore, tempUserStore);
  
  // Инъекция реальных зависимостей
  const userStore = new UserStore(authStore, socketStore);
  Object.assign(tempUserStore, userStore);
  
  return { authStore, socketStore, userStore, /* ... */ };
}

// Хуки для доступа к сторам в компонентах
export function useUserStore() {
  const stores = useContext(StoresContext);
  return stores.userStore;
}
```
</details>

<details>
<summary><strong>🎯 Virtual Scrolling</strong></summary>

Универсальный хук `useVirtualItems` для постов и комментариев:
- **Adaptive buffering** по скорости скролла
- **Memory efficiency** для больших списков  
- **Type-safe API** для любого контента

</details>

---

## 🔧 Ключевые инновации

### 🎯 Реактивная архитектура с предсказуемым состоянием
**Проблема:** Хаотичные обновления состояния приводят к race conditions.  
**Решение:** Атомарные транзакции через `runInAction` обеспечивают консистентность и автоматический откат при ошибках.

### 🔄 Интеллектуальное управление лентами
**Проблема:** Ленты сбрасывают состояние при навигации.  
**Инновация:** Буферизация новых постов + manual mode + межвкладочная персистентность. Пользователь не теряет контекст.

### 🚀 Гибридная Gateway-Queue-Consumer архитектура  
**Проблема:** REST API не обеспечивает real-time консистентность.  
**Решение:** Мгновенный ответ пользователю + гарантированная обработка в фоне + синхронизация всех клиентов.

### ⚡ Optimistic UI с автосинхронизацией
**Инновация:** Двухфазная обработка - мгновенное обновление UI + фоновая синхронизация с автооткатом при ошибках.

### 🧭 Контекстная навигация
**Особенность:** Slug-based маршрутизация + сохранение позиции скролла + предзагрузка контекста.

### 📊 Проактивный мониторинг системы
**Инновация:** Real-time мониторинг очередей с TTL, автоматическими алертами и emergency cleanup для предотвращения перегрузок.

### 🔐 Безопасность учетных записей
**Инновация:** Защита от множественного входа в аккаунт - один пользователь может быть авторизован только на одном устройстве, с уведомлением при обнаружении другой сессии.

---

## 📱 Продвинутые возможности

<details>
<summary><strong>📰 Intelligent Feed System</strong></summary>

**Трёхуровневая система лент:**
- **All Feed** - Глобальная лента всех постов
- **Following Feed** - Персонализированная лента подписок  
- **User Profiles** - Персональные страницы пользователей

**Умное поведение:**
- ✅ Состояние сохраняется при переходах между лентами
- ✅ Буферизация новых постов без потери позиции
- ✅ Manual mode - контролируемые обновления
- ✅ Межвкладочная синхронизация

</details>

<details>
<summary><strong>👥 Social Features</strong></summary>

- **Подписки на пользователей** с персонализированной лентой
- **Лайки и реакции** с optimistic updates  
- **Профили пользователей** с аватарами и статистикой

</details>

<details>
<summary><strong>🗨️ Advanced Comments System</strong></summary>

- **Неограниченная вложенность** с производительной оптимизацией
- **Ленивая загрузка веток** + сворачивание с сохранением состояния  
- **Real-time обновления** на любом уровне вложенности
- **Threaded discussions** с навигацией по веткам

</details>

<details>
<summary><strong>👑 Admin Panel & Role Management</strong></summary>

**Трёхуровневая система ролей:**
- `user` - Базовые права (создание постов/комментариев)
- `admin` - Модерация + Debug Tools + Привилегия бейджика над постом
- `superadmin` - Полный контроль + управление админами

**SuperAdmin возможности:**
- 🛡️ Промоушен пользователей в админы
- 📊 Статистика пользователей 
- 🔧 Advanced Debug Tools с генерацией тестовых данных

**Привилегии администраторов:**
- 👑 Визуальные бейджи ролей в профилях и постах
- ✅ Отправка контента без CAPTCHA-проверки
- 🛠️ Расширенные возможности модерации
- 📊 Доступ к системной статистике и debug-инструментам

**Безопасность:**
- JWT-based авторизация с проверкой ролей
- Backend валидация всех админских операций
- Frontend/Backend синхронизация ролей в реальном времени
- 🔐 Защита от множественного входа в учетную запись

**UI интеграция:**
- 🛠️ Admin Panel в Developer Settings

</details>

<details>
<summary><strong>🔍 Elasticsearch Search</strong></summary>

- Мультиентити поиск (посты/комментарии/пользователи) от 3 символов
- Real-time подсказки с debounce + табы результатов

</details>

<details>
<summary><strong>📤 Media Support</strong></summary>

- Image upload с автооптимизацией + файловые вложения
- Drag & drop с визуальной обратной связью + CAPTCHA защита

</details>

<details>
<summary><strong>🔐 Session Security</strong></summary>

**Защита от множественного входа:**
- Отслеживание активных сессий пользователей на сервере
- Автоматическое отключение предыдущей сессии при новом входе
- Уведомление пользователя о принудительном выходе с указанием причины
- Безопасная передача JWT-токенов и проверка авторизации

**Преимущества:**
- Защита от несанкционированного доступа к аккаунту
- Предотвращение утечки данных при компрометации токена
- Мгновенное оповещение владельца учетной записи о подозрительной активности

</details>

<details>
<summary><strong>📊 System Monitoring</strong></summary>

**Queue Health Monitoring:**
- **Real-time статистика** очередей сообщений
- **Автоматические алерты** при превышении лимитов (1000+ сообщений = warning, 3000+ = critical)
- **TTL контроль**: автоудаление сообщений старше 5 минут
- **Memory management**: ограничение использования RAM на 60%

**Monitoring API:**
```bash
# Детальная статистика очередей
curl http://localhost:3001/api/monitoring/queue-status

# Общее состояние системы
curl http://localhost:3001/api/monitoring/health
```

**Response примеры:**
```json
// Queue Status
{
  "totalMessages": 1500,
  "queues": {
    "posts": { "messageCount": 800, "unacknowledgedCount": 0 },
    "comments": { "messageCount": 700, "unacknowledgedCount": 0 }
  },
  "status": "warning",
  "timestamp": "2025-06-02T12:00:00Z",
  "memoryUsage": { "rss": 134217728, "heapUsed": 89456432 }
}

// Health Check
{
  "status": "ok",
  "timestamp": "2025-06-02T12:00:00Z",
  "uptime": 3600,
  "memory": { "rss": 134217728, "heapUsed": 89456432 }
}
```

</details>

<details>
<summary><strong>🐛 Debug Tools</strong></summary>

Детальная информация о состоянии лент, виртуального списка, буферов и режимов работы с кнопками для генерации тестовых данных.

</details>

---

## 🚀 Performance Optimizations

### State Management
- **Минимальные ре-рендеры** с точными MobX подписками
- **Memoized компоненты** + условный рендеринг
- **Stable keys** предотвращают лишние unmount/mount

### Virtual Scrolling  
- **Adaptive buffering** по скорости скролла
- **Memory-efficient rendering** больших списков

### Network & Queue Management
- **Optimistic updates** для мгновенной обратной связи
- **Smart caching** с stale-while-revalidate
- **Queue-based processing** для надёжности
- **TTL автоочистка** предотвращает переполнение памяти
- **Приоритизация сообщений** для критичных операций

---

## 🛠️ TODO

<details>
<summary><strong>🎯 Roadmap</strong></summary>

### API & Architecture
- [ ] Микросервисные обёртки для унификации
- [ ] Rate limiting + GraphQL интеграция

### UI/UX  
- [ ] Дизайн-система + тёмная тема
- [ ] Mobile-responsive + accessibility

### DevOps
- [ ] Service Workers для offline
- [ ] CI/CD пайплайны + комплексное тестирование

</details>

---

## 🔗 Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React 19 + TypeScript | UI с строгой типизацией |
| **State** | MobX 6 | Реактивное состояние |
| **Backend** | NestJS + TypeScript | Масштабируемая архитектура |
| **Database** | PostgreSQL + TypeORM | Реляционные данные |
| **Queue** | RabbitMQ | Надёжная обработка сообщений |
| **Real-time** | Socket.IO | WebSocket коммуникация |
| **Search** | Elasticsearch | Полнотекстовый поиск |
| **Auth** | JWT + Guards | Безопасная аутентификация |
| **Build** | Vite + SWC | Быстрая разработка |
| **Styles** | SCSS + Ant Design | UI библиотека |
| **Monitoring** | Custom Queue Monitor | Контроль производительности |

---

## 🚀 Quick Start

```bash
git clone <repo-url>
cd spa-comments
./run.sh
# Выберите 1 для локальной разработки

# Чтобы создать суперадмина если он не был создан при первом развертывании
# Выполните команду, либо создайте его через пункт 10 в меню
cd backend
npm run create-superadmin:local
```

**Мониторинг системы:**
```bash
# Проверьте статус очередей через API
curl http://localhost:3001/api/monitoring/queue-status

# Проверьте здоровье системы
curl http://localhost:3001/api/monitoring/health
```

Актуальные ссылки для доступа к приложению будут показаны в консоли после запуска.

---

<details>
<summary><strong>⚡DEMO SCREENSHOT </strong></summary>
  
![image](https://github.com/user-attachments/assets/78defeda-1053-4ea7-b166-0afa4b75b659)


</details>

---

<div align="center">

**Developed by sk8 w/ ❤️**

</div>
