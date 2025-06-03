import io from 'socket.io-client';

const getSocketURL = () => {
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}`;
  }
  return 'ws://localhost:3001';
};

const SOCKET_URL = getSocketURL();

// Утилита для задержки
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Генерация случайного текста
function randomText(length = 30) {
  const words = [
    'Lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur',
    'adipiscing', 'elit', 'sed', 'do', 'eiusmod', 'tempor',
    'incididunt', 'ut', 'labore', 'et', 'dolore', 'magna'
  ];
  const randomWords: string[] = [];
  for (let i = 0; i < length / 5; i++) {
    randomWords.push(words[Math.floor(Math.random() * words.length)]);
  }
  return randomWords.join(' ');
}

function randomUserName() {
  const adjectives = ['Cool', 'Happy', 'Smart', 'Fast', 'Bright', 'Brave'];
  const nouns = ['Cat', 'Dog', 'Fox', 'Bear', 'Wolf', 'Tiger'];
  return `${adjectives[Math.floor(Math.random() * adjectives.length)]}${nouns[Math.floor(Math.random() * nouns.length)]}${Math.floor(Math.random() * 1000)}`;
}

// Создание одного пользователя с таймаутами
async function createUserWithPosts(userIndex: number, postsPerUser: number): Promise<void> {
  const userData = {
    email: `user_${Date.now()}_${userIndex}@example.com`,
    userName: randomUserName(),
    password: 'Aa112233',
  };

  console.log(`Creating user ${userIndex}: ${userData.userName}`);

  return new Promise((resolve, reject) => {
    const userSocket = io(`${SOCKET_URL}/users`, {
      transports: ['websocket'],
      timeout: 20000, // Увеличиваем таймаут
      forceNew: true,
      reconnection: false, // Отключаем автоматические переподключения
    });

    // Общий таймаут для операции
    const operationTimeout = setTimeout(() => {
      console.error(`⏰ Operation timeout for user ${userData.userName}`);
      userSocket.disconnect();
      reject(new Error('Operation timeout'));
    }, 45000); // 45 секунд общий таймаут

    // Таймаут только для подключения
    const connectionTimeout = setTimeout(() => {
      if (!userSocket.connected) {
        console.error(`🔌 Connection timeout for user ${userData.userName}`);
        userSocket.disconnect();
        clearTimeout(operationTimeout);
        reject(new Error('Connection timeout'));
      }
    }, 10000); // 10 секунд на подключение

    userSocket.on('connect', () => {
      clearTimeout(connectionTimeout);
      console.log(`✅ Connected to /users for ${userData.userName}`);

      userSocket.emit('register', userData, async (registerResponse: {
        token?: string;
        user?: { id?: string };
        message?: string;
        success?: boolean;
      }) => {
        try {
          console.log(`📝 User ${userData.userName} registered:`, registerResponse.success ? 'SUCCESS' : 'FAILED');

          if (registerResponse.success && registerResponse.token && registerResponse.user?.id) {
            // Создаем сокет для постов с задержкой
            await delay(500); // Пауза перед созданием постов
            await createPostsForUser(userData.userName, registerResponse.token, registerResponse.user.id, postsPerUser);
          } else {
            console.error(`❌ Registration failed for ${userData.userName}:`, registerResponse.message);
          }

          // Отключаемся от users namespace
          userSocket.disconnect();
          clearTimeout(operationTimeout);
          resolve();
        } catch (error) {
          console.error(`❌ Error for user ${userData.userName}:`, error);
          userSocket.disconnect();
          clearTimeout(operationTimeout);
          reject(error);
        }
      });
    });

    userSocket.on('connect_error', (error: Error) => {
      console.error(`❌ Users socket connection error for ${userData.userName}:`, error.message);
      clearTimeout(connectionTimeout);
      clearTimeout(operationTimeout);
      reject(error);
    });

    userSocket.on('disconnect', (reason: string) => {
      console.log(`🔌 Disconnected from /users for ${userData.userName}. Reason: ${reason}`);
    });
  });
}

// Создание постов для пользователя с таймингами
async function createPostsForUser(userName: string, token: string, userId: string, postsCount: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const postSocket = io(`${SOCKET_URL}/posts`, {
      transports: ['websocket'],
      auth: { token },
      timeout: 20000,
      forceNew: true,
      reconnection: false,
      // Add test mode query parameters
      query: {
        testMode: 'true',
        testToken: 'sk8-h4ck-t0k3n-1337'
      }
    });

    let postsCreated = 0;
    let postErrors = 0; 
    let rateLimited = 0; // счетчик rate limit
    const startTime = Date.now();

    const cleanup = () => {
      postSocket.disconnect();
      const duration = Math.round((Date.now() - startTime) / 1000);
      console.log(`⏱️ User ${userName} completed in ${duration}s`);
      
      // Детальная статистика
      console.log(`📊 ${userName} FINAL STATS: ✅ ${postsCreated} created, ❌ ${postErrors} failed, 🚫 ${rateLimited} rate limited`);
      resolve();
    };

    const checkCompletion = () => {
      if (postsCreated + postErrors + rateLimited >= postsCount) {
        setTimeout(cleanup, 500); // Даем время на завершение
      }
    };

    postSocket.on('connect', async () => {
      console.log(`📡 Connected to /posts for ${userName}`);

      // Создаем посты с умной задержкой
      for (let j = 0; j < postsCount; j++) {
        // Увеличиваем задержки для избежания rate limit
        const baseDelay = 2000 + (j * 500); // 2 секунды + 0.5 сек за каждый пост
        const randomDelay = Math.random() * 1000; // Случайность 0-1000ms
        const delayMs = baseDelay + randomDelay;
        
        setTimeout(() => {
          // Проверяем что сокет еще подключен
          if (!postSocket.connected) {
            postErrors++;
            checkCompletion();
            return;
          }

          const postDto = {
            content: randomText(Math.floor(Math.random() * 200) + 100), // 100-300 символов
            userId: userId,
          };

          postSocket.emit('addPost', postDto, (postResponse: {
            success: boolean;
            message: string;
            postId?: string;
          }) => {
            if (postResponse.success) {
              postsCreated++;
              console.log(`✅ ${userName}: Post ${j + 1}/${postsCount} SUCCESS`);
            } else {
              // Проверяем тип ошибки
              if (postResponse.message.includes('Rate limit exceeded')) {
                rateLimited++;
                console.log(`🚫 ${userName}: Post ${j + 1}/${postsCount} RATE LIMITED: ${postResponse.message}`);
              } else {
                postErrors++;
                console.log(`❌ ${userName}: Post ${j + 1}/${postsCount} FAILED: ${postResponse.message}`);
              }
            }
            checkCompletion();
          });
        }, delayMs);
      }

      // Автоматическое завершение через максимальное время
      setTimeout(() => {
        if (postsCreated + postErrors + rateLimited < postsCount) {
          console.warn(`⚠️ Force completion for ${userName}: ${postsCreated}/${postsCount} posts created, ${rateLimited} rate limited`);
          cleanup();
        }
      }, Math.max(postsCount * 3000, 30000)); // время ожидания
    });

    postSocket.on('connect_error', (error: Error) => {
      console.error(`❌ Posts socket error for ${userName}:`, error.message);
      reject(error);
    });

    postSocket.on('disconnect', (reason: string) => {
      console.log(`🔌 Disconnected from /posts for ${userName}. Reason: ${reason}`);
    });
  });
}


export async function generateTestData(usersCount: number, postsPerUser: number) {
  console.log(`🚀 Starting stress test: ${usersCount} users × ${postsPerUser} posts = ${usersCount * postsPerUser} total posts`);
  console.log(`📡 Socket URL: ${SOCKET_URL}`);
  console.log(`⚠️ With rate limiting: max 10 posts per minute per user`);
  
  const startTime = Date.now();
  const BATCH_SIZE = 10;
  let totalSuccess = 0;
  let totalErrors = 0;
  
  try {
    // Разбиваем пользователей на батчи
    for (let i = 0; i < usersCount; i += BATCH_SIZE) {
      const batchEnd = Math.min(i + BATCH_SIZE, usersCount);
      const batch = [];
      
      console.log(`\n📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}: users ${i + 1}-${batchEnd}`);
      
      // Создаем промисы для текущего батча
      for (let j = i; j < batchEnd; j++) {
        batch.push(
          createUserWithPosts(j, postsPerUser)
            .then(() => {
              totalSuccess++;
              console.log(`✅ User ${j + 1} completed successfully`);
            })
            .catch((error) => {
              totalErrors++;
              console.error(`❌ User ${j + 1} failed:`, error.message);
            })
        );
      }
      
      // Ждем завершения текущего батча
      await Promise.allSettled(batch);
      console.log(`✅ Batch ${Math.floor(i / BATCH_SIZE) + 1} completed`);
      
      if (batchEnd < usersCount) {
        console.log(`⏳ Waiting 10 seconds before next batch...`);
        await delay(5000); 
      }
    }
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n🎉 Test completed in ${duration} seconds!`);
    console.log(`📊 Results: ${totalSuccess} successful, ${totalErrors} failed`);
    console.log(`📊 Note: Individual post statistics shown above include rate limiting info`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

export { generateTestData as main };