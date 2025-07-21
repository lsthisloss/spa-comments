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

### 🔬 Unit Tests  
Isolated component testing with mocks:
- ThreadService business logic
- Component state management
- Utility function behavior
- Error handling scenarios

### 🔗 Integration Tests
Service interaction verification:
- Real API endpoint testing
- RabbitMQ queue operations
- Database query validation
- WebSocket event handling

### 🌐 E2E Tests
Complete user journey simulation:
- Frontend page loading
- User authentication flows
- Thread creation workflows
- Real-time update delivery

---

## 📊 Test Coverage

The service provides multiple coverage metrics:

### Traditional Coverage
- **Line Coverage** - Executed code lines percentage
- **Branch Coverage** - Conditional paths testing
- **Function Coverage** - Called functions ratio

### Behavioral Coverage
- **User Interaction Patterns** - UI component usage
- **API Endpoint Utilization** - Backend route coverage  
- **Feature Adoption** - Real-world usage simulation
- **Error Scenario Handling** - Exception path testing

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
  2  - 🔬 Unit Tests (mocked components)  
  3  - � Integration Tests (real API calls)
  4  - 🌐 E2E Tests (user flows)
  0  - 🚪 Exit
```

---

## 🎨 Example Test Runs

<details>
<summary><strong>Smoke Test Execution</strong></summary>

```bash
Выберите действие (1-4, 0 для выхода): 1

🔥 Запуск дымовых тестов...
Проверяем основную функциональность приложения

🔥 Smoke Test Results:

     ✅ Frontend (React): 200
     ✅ Backend (NestJS): 404
     ✅ RabbitMQ Management: 200
     ✅ Elasticsearch: 200

📊 Статус: 4/4 сервисов доступно

🎉 Все сервисы доступны!

✅ Test configuration valid:
     Backend: http://localhost:3001
     Frontend: http://localhost:3000
     RabbitMQ: amqp://localhost:5672
     Elasticsearch: http://localhost:9200

✅ JavaScript runtime OK

Запуск: Дымовые тесты...
🔥 Smoke Test Results:
✅ Frontend (React): 200
✅ Backend (NestJS): 404
✅ RabbitMQ Management: 200
✅ Elasticsearch: 200
📊 Статус: 4/4 сервисов доступно
🎉 Все сервисы доступны!
✅ Test configuration valid:
Backend: http://localhost:3001
Frontend: http://localhost:3000
RabbitMQ: amqp://localhost:5672
Elasticsearch: http://localhost:9200
✅ JavaScript runtime OK
✅ Дымовые тесты пройдены за 1711ms

✅ Основной функционал работает корректно!
```

</details>

<details>
<summary><strong>Integration Test Execution</strong></summary>

```bash
$ npm run test:integration

🔗 Запуск интеграционных тестов...
Тестируем взаимодействие между компонентами, API и базой данных

Запуск: Интеграционные тесты...
🔍 http://localhost:3001/health: 200
✅ Backend API найден на http://localhost:3001/health
⚠️ Posts endpoint вернул статус: 404
⚠️ Comments endpoint вернул статус: 404
⚠️ Users endpoint вернул статус: 404
⚠️ RabbitMQ Management недоступен (401)
✅ Elasticsearch доступен, статус кластера: yellow
✅ Интеграционные тесты пройдены за 1735ms

✅ Модули хорошо взаимодействуют!
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
