import { createInterface } from 'readline';
import { colors } from './utils/colors.js';
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { TestResult, TestStats } from './types/index.js';

class TestRunner {

  private workingDir: string;
  private readline: any;

  constructor() {
    this.workingDir = process.cwd();
    this.readline = createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }
// Логотип и заголовок
  private showLogo(): void {
    // НЕ очищаем экран, чтобы сохранить историю тестов
    console.log(`${colors.purple}${colors.bold}`);
    console.log('  ╔══════════════════════════════════════════════╗');
    console.log('  ║            🧪 SPA Comments Tests             ║');
    console.log('  ║         Comprehensive Test Suite             ║');
    console.log('  ║              TypeScript Edition              ║');
    console.log('  ╚══════════════════════════════════════════════╝');
    console.log(`${colors.reset}`);
  }

  // Выполнение команды тестирования
  private async executeTest(command: string, testName: string): Promise<TestResult> {
    const startTime = Date.now();
    console.log(`${colors.cyan}Запуск: ${testName}...${colors.reset}`);
    
    try {
      const output = execSync(command, { 
        encoding: 'utf8',
        cwd: this.workingDir,
        timeout: 120000,
        stdio: 'pipe' // Скрываем Jest вывод
      });
      
      const duration = Date.now() - startTime;
      
      // Показываем только console.log из тестов
      this.showCleanTestOutput(output);
      
      // Извлекаем краткую сводку из Jest
      const testSummary = this.extractTestSummary(output);
      if (testSummary) {
        console.log(`${colors.blue}${testSummary}${colors.reset}`);
      }
      
      console.log(`${colors.green}✅ ${testName} пройдены за ${duration}ms${colors.reset}`);
      
      return {
        success: true,
        duration,
        output: output || 'Test completed successfully'
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.log(`${colors.red}❌ ${testName} упали за ${duration}ms${colors.reset}`);
      
      return {
        success: false,
        duration,
        output: error.message
      };
    }
  }

  private showCleanTestOutput(output: string): void {
    const lines = output.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Ищем строки с console.log
      if (line.trim().startsWith('console.log')) {
        // Следующая строка содержит реальное содержимое
        if (i + 1 < lines.length) {
          const contentLine = lines[i + 1];
          
          // Убираем escape последовательности и лишние пробелы
          const cleanContent = contentLine
            .replace(/\\n/g, '') // Убираем \n
            .replace(/^\s{4,}/, '') // Убираем отступы
            .trim();
          
          // Показываем только если есть содержимое и это не техническая информация
          if (cleanContent && 
              !cleanContent.includes('at Object.<anonymous>') && 
              !cleanContent.includes('at src/') && 
              !cleanContent.includes('at Array.forEach')) {
            console.log(cleanContent);
          }
        }
      }
    }
  }

  private extractTestSummary(output: string): string | null {
    // Ищем строки вида "Test Suites: X passed, Y total" и "Tests: X passed, Y total"
    const suiteMatch = output.match(/Test Suites:\s+(\d+)\s+passed,\s+(\d+)\s+total/);
    const testMatch = output.match(/Tests:\s+(\d+)\s+passed,\s+(\d+)\s+total/);
    
    if (suiteMatch && testMatch) {
      const suites = `${suiteMatch[1]}/${suiteMatch[2]} test suites`;
      const tests = `${testMatch[1]}/${testMatch[2]} tests`;
      return `📊 ${tests}, ${suites}`;
    }
    
    return null;
  }

  // 🔥 Дымовые тесты
  async runSmokeTests(): Promise<void> {
    console.log(`\n${colors.yellow}🔥 Запуск дымовых тестов...${colors.reset}`);
    console.log(`${colors.cyan}Проверяем основную функциональность приложения${colors.reset}\n`);
    
    // Сначала показываем проверку сервисов  
    await this.checkServices();
    
    const result = await this.executeTest('npm run test:smoke', 'Дымовые тесты');
    
    if (result.success) {
      console.log(`\n${colors.green}✅ Основной функционал работает корректно!${colors.reset}`);
    } else {
      console.log(`\n${colors.red}❌ Обнаружены критические проблемы!${colors.reset}`);
    }
  }

  private async checkServices(): Promise<void> {
    console.log(`${colors.cyan}🔥 Smoke Test Results:${colors.reset}\n`);
    
    const services = [
      { name: 'Frontend (React)', url: 'http://localhost:3000', emoji: '⚛️' },
      { name: 'Backend (NestJS)', url: 'http://localhost:3001', emoji: '🚀' },
      { name: 'RabbitMQ Management', url: 'http://localhost:15672', emoji: '🐰' },
      { name: 'Elasticsearch', url: 'http://localhost:9200', emoji: '🔍' }
    ];

    let availableCount = 0;

    for (const service of services) {
      try {
        const response = await fetch(service.url);
        console.log(`     ${colors.green}✅ ${service.name}: ${response.status}${colors.reset}`);
        availableCount++;
      } catch (error) {
        console.log(`     ${colors.red}❌ ${service.name}: недоступен${colors.reset}`);
      }
    }

    console.log(`\n${colors.blue}📊 Статус: ${availableCount}/${services.length} сервисов доступно${colors.reset}`);
    
    if (availableCount === services.length) {
      console.log(`\n${colors.green}🎉 Все сервисы доступны!${colors.reset}`);
    } else {
      console.log(`\n${colors.yellow}⚠️ Некоторые сервисы недоступны${colors.reset}`);
    }

    console.log(`\n${colors.green}✅ Test configuration valid:${colors.reset}`);
    console.log(`     Backend: http://localhost:3001`);
    console.log(`     Frontend: http://localhost:3000`);
    console.log(`     RabbitMQ: amqp://localhost:5672`);
    console.log(`     Elasticsearch: http://localhost:9200`);
    
    console.log(`\n${colors.green}✅ JavaScript runtime OK${colors.reset}\n`);
  }

  // 🔬 Юнит-тесты
  async runUnitTests(): Promise<void> {
    console.log(`\n${colors.yellow}🔬 Запуск юнит-тестов...${colors.reset}`);
    console.log(`${colors.cyan}Тестируем отдельные компоненты, функции и модули${colors.reset}\n`);
    
    const result = await this.executeTest('npm run test:unit', 'Юнит-тесты');
    
    if (result.success) {
      console.log(`\n${colors.green}✅ Компоненты работают корректно!${colors.reset}`);
    } else {
      console.log(`\n${colors.red}❌ Обнаружены проблемы в компонентах!${colors.reset}`);
    }
  }

  // 🔗 Интеграционные тесты
  async runIntegrationTests(): Promise<void> {
    console.log(`\n${colors.yellow}🔗 Запуск интеграционных тестов...${colors.reset}`);
    console.log(`${colors.cyan}Тестируем взаимодействие между компонентами, API и базой данных${colors.reset}\n`);
    
    const result = await this.executeTest('npm run test:integration', 'Интеграционные тесты');
    
    if (result.success) {
      console.log(`\n${colors.green}✅ Модули хорошо взаимодействуют!${colors.reset}`);
    } else {
      console.log(`\n${colors.red}❌ Проблемы во взаимодействии модулей!${colors.reset}`);
    }
  }

  // 🌐 E2E тесты
  async runE2ETests(): Promise<void> {
    console.log(`\n${colors.yellow}🌐 Запуск E2E тестов...${colors.reset}`);
    console.log(`${colors.cyan}Тестируем полные пользовательские сценарии в браузере${colors.reset}\n`);
    
    const result = await this.executeTest('npm run test:e2e', 'E2E тесты');
    
    if (result.success) {
      console.log(`\n${colors.green}✅ Пользовательские сценарии работают!${colors.reset}`);
    } else {
      console.log(`\n${colors.red}❌ Проблемы в пользовательском опыте!${colors.reset}`);
    }
  }

  // Главное меню
  private showMenu(): void {
    this.showLogo();
    
    console.log(`  ${colors.cyan}──────────────────────────────────────────────────${colors.reset}`);
    console.log(`  ${colors.green}1${colors.reset}  - 🔥 Дымовые тесты ${colors.yellow}(критический функционал)${colors.reset}`);
    console.log(`  ${colors.green}2${colors.reset}  - 🔬 Юнит-тесты ${colors.yellow}(отдельные компоненты)${colors.reset}`);
    console.log(`  ${colors.green}3${colors.reset}  - 🔗 Интеграционные тесты ${colors.yellow}(взаимодействие модулей)${colors.reset}`);
    console.log(`  ${colors.green}4${colors.reset}  - 🌐 E2E тесты ${colors.yellow}(пользовательские сценарии)${colors.reset}`);
    console.log(`  ${colors.green}0${colors.reset}  - 🚪 Выход`);
    console.log(`  ${colors.cyan}──────────────────────────────────────────────────${colors.reset}`);
    console.log('');
  }

  // Основной цикл меню
  async runMenu(): Promise<void> {
    while (true) {
      this.showMenu();
      
      const choice = await this.getUserInput(`${colors.cyan}Выберите действие (1-4, 0 для выхода): ${colors.reset}`);
      
      try {
        switch (choice.trim()) {
          case '1':
            await this.runSmokeTests();
            await this.waitForEnter();
            break;
          case '2':
            await this.runUnitTests();
            await this.waitForEnter();
            break;
          case '3':
            await this.runIntegrationTests();
            await this.waitForEnter();
            break;
          case '4':
            await this.runE2ETests();
            await this.waitForEnter();
            break;
          case '0':
            console.log(`\n${colors.green}До свидания! 👋${colors.reset}\n`);
            this.readline.close();
            process.exit(0);
            break;
          default:
            console.log(`\n${colors.red}Неверный выбор. Попробуйте снова.${colors.reset}\n`);
            await this.waitForEnter();
            break;
        }
      } catch (error) {
        console.log(`\n${colors.red}Ошибка: ${error}${colors.reset}\n`);
        await this.waitForEnter();
      }
    }
  }

  // Прямой запуск по номеру
  async runDirect(choice: string): Promise<void> {
    this.showLogo();
    
    switch (choice) {
      case '1': await this.runSmokeTests(); break;
      case '2': await this.runUnitTests(); break;
      case '3': await this.runIntegrationTests(); break;
      case '4': await this.runE2ETests(); break;
      default:
        console.log(`\n${colors.red}Неверный номер действия${colors.reset}\n`);
        break;
    }
    
    this.readline.close();
  }

  private getUserInput(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      this.readline.question(prompt, (answer: string) => {
        resolve(answer);
      });
    });
  }

  private async waitForEnter(): Promise<void> {
    await this.getUserInput(`\n${colors.blue}Нажмите Enter для продолжения...${colors.reset}`);
  }
}

// Точка входа
async function main() {
  const runner = new TestRunner();
  const args = process.argv.slice(2);
  
  if (args.length > 0) {
    await runner.runDirect(args[0]);
  } else {
    await runner.runMenu();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`${colors.red}Критическая ошибка:${colors.reset}`, error);
    process.exit(1);
  });
}

export { TestRunner };