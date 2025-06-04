const { Worker } = require('worker_threads');
const path = require('path');

const API_URL = 'http://localhost:3001/comments'; // или ваш реальный backend-URL
const THREAD_COUNT = 5;
const TOTAL_REQUESTS = 100;
const REQUESTS_PER_THREAD = Math.ceil(TOTAL_REQUESTS / THREAD_COUNT);

const startWorker = (threadIndex) => {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.resolve(__dirname, 'worker.js'), {
      workerData: {
        apiUrl: API_URL,
        requests: REQUESTS_PER_THREAD,
        threadIndex,
      },
    });

    worker.on('message', (message) => {
      console.log(`Thread ${threadIndex}:`, message);
    });

    worker.on('error', (error) => {
      console.error(`Thread ${threadIndex} encountered an error:`, error);
      reject(error);
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Thread ${threadIndex} stopped with exit code ${code}`));
      } else {
        resolve();
      }
    });
  });
};

const runLoadTest = async () => {
  const workers = [];
  for (let i = 0; i < THREAD_COUNT; i++) {
    workers.push(startWorker(i));
  }

  try {
    await Promise.all(workers);
    console.log('Load test completed.');
  } catch (error) {
    console.error('Load test failed:', error);
  }
};

runLoadTest();