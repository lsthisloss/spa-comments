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
    let isProcessingConsoleLog = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Начинаем обработку console.log блока
      if (line.trim().startsWith('console.log')) {
        isProcessingConsoleLog = true;
        continue;
      }
      
      // Если мы в блоке console.log
      if (isProcessingConsoleLog) {
        // Пропускаем пустые строки
        if (!line.trim()) {
          continue;
        }
        
        // Пропускаем строки со стек-трейсом
        if (line.includes('at ') || 
            line.includes('Object.<anonymous>') ||
            line.includes('.test.') ||
            line.includes('(src/') ||
            line.includes('node_modules') ||
            line.includes('Array.forEach')) {
          isProcessingConsoleLog = false;
          continue;
        }
        
        // Это содержимое console.log - показываем его
        const cleanContent = line
          .replace(/^\s+/, '') // Убираем начальные пробелы
          .trim();
        
        if (cleanContent) {
          console.log(cleanContent);
          isProcessingConsoleLog = false;
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
    console.log(`\nДымовые тесты - проверка основной функциональности\n`);
    
    const result = await this.executeTest('npm run test:smoke', 'Дымовые тесты');
    
    if (result.success) {
      console.log(`\nОсновной функционал работает корректно`);
    } else {
      console.log(`\nОбнаружены критические проблемы`);
    }
  }

  // 🔬 Юнит-тесты
  async runUnitTests(): Promise<void> {
    console.log(`\nЮнит-тесты - тестирование реальных компонентов\n`);
    
    const result = await this.executeTest('npm run test:unit', 'Юнит-тесты');
    
    if (result.success) {
      console.log(`\nВсе компоненты работают правильно`);
    } else {
      console.log(`\nОбнаружены проблемы в компонентах`);
    }
  }

  // ⚛️ React тесты  
  async runReactTests(): Promise<void> {
    console.log(`\nReact тесты - тестирование UI компонентов\n`);
    
    const result = await this.executeTest('npm run test:react', 'React тесты');
    
    if (result.success) {
      console.log(`\nReact компоненты работают корректно`);
    } else {
      console.log(`\nПроблемы в React компонентах`);
    }
  }

  // 🔗 Интеграционные тесты
  async runIntegrationTests(): Promise<void> {
    console.log(`\nИнтеграционные тесты - взаимодействие между сервисами\n`);
    
    const result = await this.executeTest('npm run test:integration', 'Интеграционные тесты');
    
    if (result.success) {
      console.log(`\nМодули взаимодействуют корректно`);
    } else {
      console.log(`\nПроблемы во взаимодействии модулей`);
    }
  }

  // 🌐 E2E тесты
  async runE2ETests(): Promise<void> {
    console.log(`\nE2E тесты - полные пользовательские сценарии\n`);
    
    const result = await this.executeTest('npm run test:e2e', 'E2E тесты');
    
    if (result.success) {
      console.log(`\nПользовательские сценарии работают`);
    } else {
      console.log(`\nПроблемы в пользовательском опыте`);
    }
  }

  // Главное меню
  private showMenu(): void {
    this.showLogo();
    
    console.log(`  ──────────────────────────────────────────────────`);
    console.log(`  1  - Дымовые тесты (критический функционал)`);
    console.log(`  2  - Юнит-тесты (отдельные компоненты)`);
    console.log(`  3  - React тесты (компоненты интерфейса)`);
    console.log(`  4  - Интеграционные тесты (взаимодействие модулей)`);
    console.log(`  5  - E2E тесты (пользовательские сценарии)`);
    console.log(`  0  - Выход`);
    console.log(`  ──────────────────────────────────────────────────`);
    console.log('');
  }

  // Основной цикл меню
  async runMenu(): Promise<void> {
    while (true) {
      this.showMenu();
      
      const choice = await this.getUserInput(`${colors.cyan}Выберите действие (1-5, 0 для выхода): ${colors.reset}`);
      
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
            await this.runReactTests();
            await this.waitForEnter();
            break;
          case '4':
            await this.runIntegrationTests();
            await this.waitForEnter();
            break;
          case '5':
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
      case '3': await this.runReactTests(); break;
      case '4': await this.runIntegrationTests(); break;
      case '5': await this.runE2ETests(); break;
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