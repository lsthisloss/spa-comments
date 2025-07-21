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
Быстрая проверка доступности сервисов:
- Проверка HTTP статусов (200, 404, 401)
- Базовая валидация конфигурации
- Проверка что сервисы запущены

### 🔬 Unit Tests
Тестирование отдельных функций и классов:
- Валидация файлов (FileUtils)
- Расчет размеров изображений
- Проверка констант и настроек
- Без сетевых запросов

### ⚛️ React Tests
Тестирование React компонентов:
- Рендеринг компонентов
- Обработка props и состояния
- Логика загрузки изображений
- Обработка ошибок UI

### 🔗 Integration Tests
Тестирование взаимодействия между сервисами:
- WebSocket подключения
- Авторизация через токены
- RabbitMQ и Elasticsearch
- Реальные API вызовы

### 🌐 E2E Tests
Тестирование полных пользовательских сценариев:
- Загрузка веб-страниц
- Симуляция пользовательских действий
- Проверка работы всего стека

---

## 🎨 Example Test Runs

<details>
<summary><strong>Smoke Tests - Проверка доступности</strong></summary>

```bash
Smoke тесты - проверка основной функциональности

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
✅ Дымовые тесты пройдены за 1849ms

Основной функционал работает корректно
```

</details>

<details>
<summary><strong>Unit Tests - Тестирование функций</strong></summary>

```bash

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
✅ Юнит-тесты пройдены за 2564ms

Основной функционал работает корректно
```

</details>

<details>
<summary><strong>React Tests - Тестирование компонентов</strong></summary>

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
✅ React тесты пройдены за 2337ms

React компоненты работают корректно
```

</details>

<details>
<summary><strong>Integration Tests - Взаимодействие сервисов</strong></summary>

```bash
Запуск: Интеграционные тесты...

HTTP Health: 200
Backend WebSocket сервер работает на http://localhost:3001
Попытка подключения к WebSocket...
WebSocket подключен! ID: dxvoCrNz...
WebSocket отключен: io client disconnect
Тестируем авторизацию и список пользователей...
✅ WebSocket авторизация успешна! ID: jEpLqeeZ...
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
✅ Интеграционные тесты пройдены за 2969ms

Модули взаимодействуют корректно
```

</details>

<details>
<summary><strong>E2E Tests - Пользовательские сценарии</strong></summary>

```bash
Запуск: E2E тесты...

✅ Frontend доступен на http://localhost:3000
✅ Главная страница загружается (772 chars)
React root: ✅
Scripts: ✅
✅ API Workflow симуляция:
Health check: ✅
Posts API: ❌
Comments API: ❌
\n🌐 Full Stack Status Check:
✅ Frontend (React): 200
✅ Backend (NestJS): 404
✅ RabbitMQ Management: 200
✅ Elasticsearch: 200
\n📊 Доступно сервисов: 4/4
✅ E2E тесты пройдены за 1903ms

Основной функционал работает корректно
</details>

---

## 🚀 Запуск

```bash
cd test-service
npm install
npm run test-menu
```

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
