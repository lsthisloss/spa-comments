# 🚀 Jeez! - TypeScript Fullstack SPA-приложение

**Современная социальная платформа в реальном времени с интеллектуальными лентами, системой ролей и продвинутой архитектурой**

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![RabbitMQ](https://img.shields.io/badge/RabbitMQ-FF6600?style=for-the-badge&logo=rabbitmq&logoColor=white)
![WebSocket](https://img.shields.io/badge/Socket.io-black?style=for-the-badge&logo=socket.io&badgeColor=010101)


---

## 🌟 О проекте

- 📱 **Посты и комментарии** с неограниченной вложенностью
- 👥 **Система подписок** - следи за интересными пользователями  
- 🔍 **Глобальный поиск** по постам, комментариям и пользователям
- 👑 **Трёхуровневая система ролей** с админ-панелью
- ⚡ **Real-time** обновления всего контента
- 📊 **Интеллектуальные ленты** - All/Following/User с умным кэшированием
- 🎯 **Optimistic UI** - мгновенные лайки и реакции
- 🔐 **Безопасность** - JWT авторизация + CAPTCHA защита

---

## 🌟 Возможности социальной платформы

- **📝 Публикация контента**: Создание постов с медиа-файлами и форматированием
- **💬 Социальное взаимодействие**: Комментарии, лайки, подписки на пользователей
- **📰 Персонализированные ленты**: All, Following, User профили с сохранением состояния
- **🔍 Умный поиск**: Elasticsearch для мгновенного поиска контента и людей
- **👤 Профили пользователей**: Персональные страницы с постами
- **🛡️ Модерация**: Система ролей user/admin/superadmin с правами управления
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

### Frontend: Реактивность + Производительность

<details>
<summary><strong>⚡ MobX State Management</strong></summary>

- **Strict Mode** с атомарными транзакциями через `runInAction`
- **Observer components** - автоматический ре-рендер только затронутых компонентов
- **Predictable updates** - все изменения в одной транзакции

</details>

<details>
<summary><strong>🎯 Virtual Scrolling</strong></summary>

Универсальный хук `useVirtualItems` для постов и комментариев:
- **Adaptive buffering** по скорости скролла
- **Memory efficiency** для больших списков  
- **Type-safe API** для любого контента

</details>
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

---

## 📱 Продвинутые возможности


<details>
<summary><strong>👑 Admin Panel & Role Management</strong></summary>

**Трёхуровневая система ролей:**
- `user` - Базовые права (создание постов/комментариев)
- `admin` - Модерация + Debug Tools
- `superadmin` - Полный контроль + управление админами

**SuperAdmin возможности:**
- 🛡️ Промоушен пользователей в админы
- 🔧 Advanced Debug Tools с генерацией тестовых данных

**Безопасность:**
- JWT-based авторизация с проверкой ролей
- Backend валидация всех админских операций
- Frontend/Backend синхронизация ролей в реальном времени

**UI интеграция:**
- 🛠️ Admin Panel в Developer Settings
- ⚡ Контекстные админские функции в интерфейсе

</details>

<details>
<summary><strong>🔍 Elasticsearch Search</strong></summary>

- Мультиентити поиск (посты/комментарии/пользователи) от 3 символов
- Real-time подсказки с debounce + табы результатов

</details>

<details>
<summary><strong>🗨️ Nested Comments</strong></summary>

- Неограниченная глубина с производительной оптимизацией
- Ленивая загрузка веток + сворачивание с сохранением состояния
- Real-time обновления на любом уровне вложенности

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

### Network
- **Optimistic updates** для мгновенной обратной связи
- **Smart caching** с stale-while-revalidate
- **Queue-based processing** для надёжности

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

Актуальные ссылки для доступа к приложению будут показаны в консоли после запуска.

---

<div align="center">

**Developed by sk8 w/ ❤️**

</div>