const axios = require('axios');
const { parentPort, workerData } = require('worker_threads');

const { apiUrl, requests, threadIndex } = workerData;

const createComment = async (index) => {
  try {
    const response = await axios.post(apiUrl, {
      userName: `TestUser${threadIndex}-${index}`,
      email: `testuser${threadIndex}-${index}@example.com`,
      text: `This is a test comment from thread ${threadIndex} #${index}`,
      homePage: `http://example${threadIndex}-${index}.com`,
      parentId: null,
    });
    parentPort.postMessage(`Comment #${index} added by thread ${threadIndex}: ${response.status}`);
  } catch (error) {
    parentPort.postMessage(`Error adding comment #${index} by thread ${threadIndex}: ${error.message}`);
  }
};

const runWorker = async () => {
  for (let i = 1; i <= requests; i++) {
    await createComment(i);
  }
  parentPort.postMessage(`Thread ${threadIndex} completed.`);
};

runWorker();