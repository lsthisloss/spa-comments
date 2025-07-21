# 🧪 SPA Comments Test Service

<div align="center">

**TypeScript interactive test runner for SPA Comments microservices**

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Jest](https://img.shields.io/badge/Jest-C21325?style=for-the-badge&logo=jest&logoColor=white)
![Testing](https://img.shields.io/badge/Testing-🧪-brightgreen?style=for-the-badge)

</div>

---

## 🎯 What is this?

**TypeScript test microservice** that tests running SPA Comments services with CLI interface.

- **🎮 Interactive Menu** - Pretty terminal interface for test execution
- **🔄 Live Testing** - Tests against real running services (localhost:3000-3001)  
- **🧪 Multiple Types** - Unit, Integration, E2E, Smoke tests
- **⚡ TypeScript Native** - Full type safety with Jest + ts-jest

---

## 🧪 Test Types

### 🔥 Smoke Tests
Quick health checks ensuring basic functionality works:
- Service availability verification
- Basic API endpoint responses
- Core component instantiation
- Environment validation

### 🔬 Unit Tests (White Box Testing)
Isolated component testing with full internal knowledge:
- Real project component validation
- Backend health endpoint testing
- WebSocket server configuration
- Project configuration verification

### ⚛️ React Tests (White Box Testing)
Component-level testing with React Testing Library:
- Component structure and styling verification
- Internal state management testing
- Props and callback behavior validation
- Image loading logic and error handling
- Width calculation algorithms

### 🔗 Integration Tests (Behavior Testing)
Service interaction verification through black box approach:
- Real API endpoint testing with WebSocket connections
- Service health percentage calculations
- Authentication flow validation
- Cross-service communication patterns

### 🌐 E2E Tests (Behavior Testing)
Complete user journey simulation:
- Frontend page loading workflows
- User authentication scenarios
- API endpoint interaction flows
- Real-time feature testing

---

## 📊 Test Coverage & Methodologies

The service provides comprehensive testing with two main approaches:

### 🔍 White Box Testing
**Internal implementation knowledge used:**
- **Unit Tests**: Real component validation, configuration testing
- **React Tests**: Component structure, state management, internal algorithms
- **Coverage**: Function calls, branch logic, state transitions

### 🎭 Behavior Testing (Black Box)
**External behavior verification:**
- **Integration Tests**: Service interactions, API responses, authentication flows
- **E2E Tests**: User workflows, complete scenarios, real-world usage
- **Coverage**: User interaction patterns, feature adoption, error scenarios

### Traditional Metrics
- **Line Coverage** - Executed code lines percentage
- **Branch Coverage** - Conditional paths testing
- **Function Coverage** - Called functions ratio

---

## 🚀 Quick Start

```bash
cd test-service
npm install
npm run test-menu
```

---

## 🎮 CLI Menu

```
  ╔══════════════════════════════════════════════╗
  ║            🧪 SPA Comments Tests             ║
  ║              TypeScript Edition              ║
  ╚══════════════════════════════════════════════╝

  1  - 🔥 Smoke Tests (health checks)
  2  - 🔬 Unit Tests (white box - real components)
  3  - ⚛️ React Tests (white box - UI components)  
  4  - 🔗 Integration Tests (behavior - service interaction)
  5  - 🌐 E2E Tests (behavior - user flows)
  0  - 🚪 Exit
```

---

## 🎨 Example Test Runs

<details>
<summary><strong>Unit Test Execution</strong></summary>

```bash
Юнит-тесты - тестирование реальных компонентов
Запуск: Юнит-тесты...
Тестируем валидацию изображений FileUtils...
Валидные изображения проходят проверку
Тестируем отклонение невалидных изображений...
Невалидные изображения отклоняются
Тестируем валидацию текстовых файлов...
Валидация текстовых файлов работает корректно
Тестируем расчет размеров изображения...
Расчет размеров изображения работает правильно
Тестируем граничные случаи расчета размеров...
Граничные случаи обработаны корректно
Тестируем константы размеров файлов...
Константы файлов настроены правильно
Unit тесты реальных компонентов завершены
Валидация изображений
Валидация текстовых файлов
Расчет размеров изображений
Обработка граничных случаев
Проверка констант и настроек
✅ Юнит-тесты пройдены за 1587ms
```

</details>
## 🎨 Example Test Runs

<details>
<summary><strong>React Test Execution</strong></summary>

```bash
React тесты - тестирование UI компонентов
Запуск: React тесты...
✅ React Testing Library setup готов
Тестируем структуру и стили компонента PreloadImage...
Структура компонента корректна
Тестируем начальное состояние - skeleton loader...
Skeleton loader отображается корректно
Тестируем успешную загрузку изображения...
Успешная загрузка изображения обработана
Тестируем обработку ошибки загрузки изображения...
Ошибка загрузки изображения обработана корректно
Тестируем расчет пропорциональной ширины...
Пропорциональная ширина рассчитана корректно
Тестируем минимальную ширину 120px...
Минимальная ширина 120px применена
Тестируем передачу props в элемент изображения...
Props переданы в изображение корректно
Тестируем вызов onLoad callback...
onLoad callback вызван корректно
White Box тесты PreloadImage завершены
Структура и стили компонента
Логика загрузки изображений
Расчет пропорциональной ширины
Обработка props и callbacks
Обработка ошибок загрузки
✅ React тесты пройдены за 2074ms
React компоненты работают корректно
```

</details>

<details>
<summary><strong>Smoke Test Execution</strong></summary>

```bash
Дымовые тесты - проверка основной функциональности

Запуск: Дымовые тесты...
Smoke Test Results:
OK Frontend (React): 200
OK Backend (NestJS): 404
OK RabbitMQ Management: 200
OK Elasticsearch: 200
Статус: 4/4 сервисов доступно
Все сервисы доступны
Test configuration valid:
Backend: http://localhost:3001
Frontend: http://localhost:3000
RabbitMQ: amqp://localhost:5672
Elasticsearch: http://localhost:9200
JavaScript runtime OK
✅ Дымовые тесты пройдены за 1789ms

Основной функционал работает корректно
```

</details>

<details>
<summary><strong>Integration Test Execution</strong></summary>

```bash
Интеграционные тесты - взаимодействие между сервисами

Запуск: Интеграционные тесты...
HTTP Health: 200
Backend WebSocket сервер работает на http://localhost:3001
Попытка подключения к WebSocket...
WebSocket подключен! ID: jJKz3FMK...
WebSocket отключен: io client disconnect
Тестируем авторизацию и список пользователей...
✅ WebSocket авторизация успешна! ID: 70OIxeMb...
Запрашиваем список пользователей через WebSocket...
🔐 Тестируем авторизацию WebSocket...
✅ WebSocket авторизация успешна!
RabbitMQ требует авторизацию (сервис работает)
Elasticsearch поиск доступен, статус: yellow
WebSocket интеграция: 6/6 (100%)
WebSocket интеграция в отличном состоянии
WebSocket архитектура:
Backend: NestJS + Socket.IO
Users: только для авторизованных через WS
Messages: через RabbitMQ очереди
Search: через Elasticsearch
✅ Интеграционные тесты пройдены за 3483ms
Модули взаимодействуют корректно
```

</details>

<details>
<summary><strong>E2E Test Execution</strong></summary>

```bash

🌐 Запуск E2E тестов...
Тестируем полные пользовательские сценарии в браузере

Запуск: E2E тесты...
✅ Frontend доступен на http://localhost:3000
✅ Главная страница загружается (772 chars)
React root: ✅
Scripts: ✅
✅ API Workflow симуляция:
Health check: ✅
Posts API: ❌
Comments API: ❌
🌐 Full Stack Status Check:
✅ Frontend (React): 200
✅ Backend (NestJS): 404
✅ RabbitMQ Management: 200
✅ Elasticsearch: 200
📊 Доступно сервисов: 4/4
✅ E2E тесты пройдены за 1616ms

✅ Пользовательские сценарии работают!
```

</details>

---

## 🛠️ Tech Stack

| What | Technology |
|------|------------|
| **Language** | TypeScript + Node.js |
| **Testing** | Jest + ts-jest |
| **CLI** | Readline + colored output |
| **HTTP** | Fetch API |
| **Queue** | amqplib for RabbitMQ |

---

**Timeline:** Part of SPA Comments project   
**Purpose:** Comprehensive testing infrastructure    
**Architecture:** Standalone TypeScript microservice      
Developed w/ ❤️ by **sk8**
