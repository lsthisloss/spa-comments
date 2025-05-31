import * as ioClient from 'socket.io-client';

const io = ioClient;
// Ваши данные пользователя
const userData = {
  email: `anon_post_${Date.now()}@example.com`,
  userName: `AnonPost${Date.now()}`,
  password: 'Aa112233',
};

// Количество постов
const POSTS_COUNT = 40;

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
  const randomText = randomWords.join(' ');

  return randomText;
}

function main() {
  // 1. Регистрируем пользователя
  const userSocket = io('ws://localhost:3001/users', {
    transports: ['websocket'],
  });

  userSocket.on('connect', () => {
    console.log('Connected to /users namespace!');

    userSocket.emit(
      'register',
      userData,
      (registerResponse: {
        token?: string;
        user?: { id?: string };
        message?: string;
      }) => {
        console.log('Ответ на register:', registerResponse);

        console.log('Waiting 1 second before login...');
        setTimeout(() => {
          // 2. Логинимся
          userSocket.emit(
            'login',
            {
              email: userData.email.trim(),
              password: userData.password.trim(),
            },
            (loginResponse: {
              success: boolean;
              token?: string;
              user?: { id?: string };
              message?: string;
            }) => {
              console.log('Ответ на login:', loginResponse);

              if (loginResponse.success && loginResponse.token) {
                userSocket.disconnect();

                // 3. Подключаемся к /posts с токеном
                const postSocket = io('ws://localhost:3001/posts', {
                  transports: ['websocket'],
                  auth: { token: loginResponse.token },
                });

                postSocket.on('connect', () => {
                  console.log('Connected to /posts namespace!');

                  // 4. Добавляем посты
                  let sent = 0;
                  for (let i = 0; i < POSTS_COUNT; i++) {
                    const postDto = {
                      content: randomText(Math.floor(Math.random() * 600) + 1),
                      userId: loginResponse.user?.id,
                    };
                    postSocket.emit('addPost', postDto, (postResponse) => {
                      console.log(`Post #${i + 1} response:`, postResponse);
                      sent++;
                      if (sent === POSTS_COUNT) {
                        postSocket.disconnect();
                      }
                    });
                  }
                });

                postSocket.on('disconnect', () => {
                  console.log('Disconnected from /posts');
                });
              } else {
                console.error('Login failed:', loginResponse);

                if (registerResponse.token) {
                  console.log(
                    'Trying to use token from registration instead...',
                  );

                  const postSocket = io('ws://localhost:3001/posts', {
                    transports: ['websocket'],
                    auth: { token: registerResponse.token },
                  });

                  postSocket.on('connect', () => {
                    console.log(
                      'Connected to /posts namespace with registration token!',
                    );

                    let sent = 0;
                    for (let i = 0; i < POSTS_COUNT; i++) {
                      const postDto = {
                        content: randomText(
                          Math.floor(Math.random() * 600) + 1,
                        ),
                        userId: registerResponse.user?.id,
                      };
                      postSocket.emit('addPost', postDto, (postResponse) => {
                        console.log(`Post #${i + 1} response:`, postResponse);
                        sent++;
                        if (sent === POSTS_COUNT) {
                          postSocket.disconnect();
                        }
                      });
                    }
                  });
                } else {
                  userSocket.disconnect();
                }
              }
            },
          );
        }, 1000); // Подождать 1 секунду перед логином
      },
    );
  });

  userSocket.on('disconnect', () => {
    console.log('Disconnected from /users');
  });
}

main();
