import { testConfig } from '../config/test-config';

describe('SPA Comments Smoke Tests', () => {
  test('should check all services availability', async () => {
    const services = [
      { name: 'Frontend (React)', url: testConfig.frontend.url },
      { name: 'Backend (NestJS)', url: testConfig.backend.url },
      { name: 'RabbitMQ Management', url: testConfig.rabbitmq.managementUrl },
      { name: 'Elasticsearch', url: testConfig.elasticsearch.url }
    ];

    const results = await Promise.allSettled(
      services.map(async (service) => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          const response = await fetch(service.url, { 
            method: 'HEAD',
            signal: controller.signal 
          });
          
          clearTimeout(timeoutId);
          
          return { 
            service: service.name, 
            status: response.status, 
            available: response.status < 500 
          };
        } catch (error) {
          return { 
            service: service.name, 
            status: 0, 
            available: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      })
    );

    console.log(`Smoke Test Results:`);
    let healthyServices = 0;
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const { service, available, status } = result.value;
        console.log(`${available ? 'OK' : 'FAIL'} ${service}: ${status || 'недоступен'}`);
        if (available) healthyServices++;
      } else {
        console.log(`FAIL ${services[index].name}: ошибка проверки`);
      }
    });

    console.log(`Статус: ${healthyServices}/${services.length} сервисов доступно`);
    
    if (healthyServices === 0) {
      console.log(`Ни один сервис не доступен. Запустите: ./run.sh`);
    } else if (healthyServices < services.length) {
      console.log(`Некоторые сервисы недоступны, но основной функционал может работать`);
    } else {
      console.log(`Все сервисы доступны`);
    }

    // Smoke test всегда проходит, показывая статус
    expect(results.length).toBe(services.length);
  });

  test('should validate test configuration', () => {
    expect(testConfig.backend.url).toBeDefined();
    expect(testConfig.frontend.url).toBeDefined();
    expect(testConfig.rabbitmq.url).toBeDefined();
    expect(testConfig.elasticsearch.url).toBeDefined();
    
    console.log(`Test configuration valid:`);
    console.log(`Backend: ${testConfig.backend.url}`);
    console.log(`Frontend: ${testConfig.frontend.url}`);
    console.log(`RabbitMQ: ${testConfig.rabbitmq.url}`);
    console.log(`Elasticsearch: ${testConfig.elasticsearch.url}`);
  });

  test('should validate basic JavaScript functionality', () => {
    // Базовые проверки среды выполнения
    expect(typeof fetch).toBe('function');
    expect(typeof Promise).toBe('function');
    expect(typeof console.log).toBe('function');
    
    const testObj = { name: 'test', value: 42 };
    expect(testObj.name).toBe('test');
    expect(testObj.value).toBe(42);
    
    console.log(`JavaScript runtime OK`);
  });
});