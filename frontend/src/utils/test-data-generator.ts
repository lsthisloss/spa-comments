import io from 'socket.io-client';

// Получаем базовый URL для WebSocket
const getSocketURL = () => {
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}`;
  }
  return 'ws://localhost:3001';
};

const SOCKET_URL = getSocketURL();

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

// Генерация случайного имени пользователя
function randomUserName() {
  const adjectives = ['Cool', 'Happy', 'Smart', 'Fast', 'Bright', 'Brave'];
  const nouns = ['Cat', 'Dog', 'Fox', 'Bear', 'Wolf', 'Tiger'];
  return `${adjectives[Math.floor(Math.random() * adjectives.length)]}${nouns[Math.floor(Math.random() * nouns.length)]}${Math.floor(Math.random() * 1000)}`;
}

export function generateTestData(usersCount: number, postsPerUser: number) {
  console.log(`Starting test with ${usersCount} users, ${postsPerUser} posts each`);
  
 console.log(
    `Starting test with ${usersCount} users, ${postsPerUser} posts each. Socket URL: ${SOCKET_URL}`,
  );

  for (let i = 0; i < usersCount; i++) {
    const userData = {
      email: `user_${Date.now()}_${i}@example.com`,
      userName: randomUserName(),
      password: 'Aa112233',
    };

    const userSocket = io(`${SOCKET_URL}/users`, {
      transports: ['websocket'],
      timeout: 10000, // 10 секунд таймаут
      forceNew: true,
    });

    userSocket.on('connect', () => {
      console.log(
        `Connected to /users namespace for user ${userData.userName}`,
      );

      userSocket.emit(
        'register',
        userData,
        (registerResponse: {
          token?: string;
          user?: { id?: string };
          message?: string;
          success?: boolean;
        }) => {
          console.log(
            `User ${userData.userName} registered:`,
            registerResponse,
          );

          if (
            registerResponse.success &&
            registerResponse.token &&
            registerResponse.user?.id
          ) {
            const postSocket = io(`${SOCKET_URL}/posts`, {
              transports: ['websocket'],
              auth: { token: registerResponse.token },
              timeout: 10000,
              forceNew: true,
            });

            postSocket.on('connect', () => {
              console.log(
                `Connected to /posts namespace for user ${userData.userName}`,
              );

              // Отправляем посты с небольшой задержкой
              for (let j = 0; j < postsPerUser; j++) {
                setTimeout(() => {
                  const postDto = {
                    content: randomText(Math.floor(Math.random() * 600) + 1),
                    userId: registerResponse.user?.id ?? null,
                  };

                  postSocket.emit(
                    'addPost',
                    postDto,
                    (postResponse: {
                      success: boolean;
                      message: string;
                      postId?: string;
                    }) => {
                      console.log(
                        `Post #${j + 1} for user ${userData.userName}:`,
                        postResponse,
                      );
                    },
                  );
                }, j * 100); // 100ms задержка между постами
              }

              // Отключаемся через больше времени
              setTimeout(
                () => {
                  postSocket.disconnect();
                },
                postsPerUser * 100 + 3000,
              );
            });

            postSocket.on('connect_error', (error: Error) => {
              console.error(
                `Posts socket connection error for ${userData.userName}:`,
                error,
              );
            });

            postSocket.on('disconnect', (reason: string) => {
              console.log(
                `Disconnected from /posts for user ${userData.userName}. Reason:`,
                reason,
              );
            });
          } else {
            console.error(
              `Registration failed for ${userData.userName}:`,
              registerResponse,
            );
          }

          setTimeout(
            () => {
              userSocket.disconnect();
            },
            postsPerUser * 100 + 5000,
          );
        },
      );
    });

    userSocket.on('connect_error', (error: Error) => {
      console.error(
        `Users socket connection error for ${userData.userName}:`,
        error,
      );
    });

    userSocket.on('disconnect', (reason: string) => {
      console.log(
        `Disconnected from /users for user ${userData.userName}. Reason:`,
        reason,
      );
    });

    // Небольшая задержка между созданием пользователей
    if (i < usersCount - 1) {
      setTimeout(() => {}, i * 500);
    }
  }
}