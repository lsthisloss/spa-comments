import io from 'socket.io-client';



// Генерация случайного текста до 600 символов
function randomText(length = 30) {
  const words = [
    'Lorem',
    'ipsum',
    'dolor',
    'sit',
    'amet',
    'consectetur',
    'adipiscing',
    'elit',
    'sed',
    'do',
    'eiusmod',
    'tempor',
    'incididunt',
    'ut',
    'labore',
    'et',
    'dolore',
    'magna',
    'aliqua',
    'ut',
    'enim',
    'ad',
    'minim',
    'veniam',
    'quis',
    'nostrud',
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


// Основная функция
function main(usersCount: number, postsPerUser: number) {
  for (let i = 0; i < usersCount; i++) {
    const userData = {
      email: `user_${Date.now()}_${i}@example.com`,
      userName: randomUserName(),
      password: 'Aa112233',
    };

    const userSocket = io('ws://localhost:3001/users', {
      transports: ['websocket'],
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
        }) => {
          console.log(
            `User ${userData.userName} registered:`,
            registerResponse,
          );

          if (registerResponse.token && registerResponse.user?.id) {
            const postSocket = io('ws://localhost:3001/posts', {
              transports: ['websocket'],
              auth: { token: registerResponse.token },
            });

            postSocket.on('connect', () => {
              console.log(
                `Connected to /posts namespace for user ${userData.userName}`,
              );

              for (let j = 0; j < postsPerUser; j++) {
                const postDto = {
                  content: randomText(Math.floor(Math.random() * 600) + 1),
                  userId: registerResponse.user?.id ?? null,
                };
                postSocket.emit('addPost', postDto, (postResponse: { success: boolean; message: string; postId?: string }) => {
                  console.log(
                    `Post #${j + 1} for user ${userData.userName}:`,
                    postResponse,
                  );
                });
              }

              setTimeout(() => postSocket.disconnect(), 5000);
            });

            postSocket.on('disconnect', () => {
              console.log(
                `Disconnected from /posts for user ${userData.userName}`,
              );
            });
          }

          setTimeout(() => userSocket.disconnect(), 5000);
        },
      );
    });

    userSocket.on('disconnect', () => {
      console.log(`Disconnected from /users for user ${userData.userName}`);
    });
  }
}

// Экспортируем функцию для вызова из DebugInfo
export { main as generateTestData };
