export const testConfig = {
  backend: {
    url: 'http://localhost:3001',
    apiPrefix: '' // Попробуем без префикса сначала
  },
  frontend: {
    url: 'http://localhost:3000'
  },
  database: {
    host: 'localhost',
    port: 5432,
    database: 'spa_comments'
  },
  rabbitmq: {
    url: 'amqp://localhost:5672',
    managementUrl: 'http://localhost:15672'
  },
  elasticsearch: {
    url: 'http://localhost:9200'
  }
};