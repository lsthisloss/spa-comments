import * as ioClient from 'socket.io-client';

const io = ioClient;
const userData = {
  email: `anon2_search_${Date.now()}@example.com`,
  userName: `Anon2Search${Date.now()}`,
  password: 'Aa112233',
};

function main() {
  console.log('PID:', process.pid);
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

                // 3. Подключаемся к /search с токеном
                const searchSocket = io('ws://localhost:3001/search', {
                  transports: ['websocket'],
                  auth: { token: loginResponse.token },
                });

                searchSocket.on('connect', () => {
                  console.log('Connected to /search namespace!');

                  // 4. Отправляем запрос поиска
                  searchSocket.emit(
                    'search',
                    { query: 'anon' },
                    (searchResponse) => {
                      console.log('Search response:', searchResponse);
                      searchSocket.disconnect();
                    },
                  );
                });

                searchSocket.on('disconnect', () => {
                  console.log('Disconnected from /search');
                });
              } else {
                console.error('Login failed:', loginResponse);

                // Альтернативный подход - используем токен из регистрации
                if (registerResponse.token) {
                  const searchSocket = io('ws://localhost:3001/search', {
                    transports: ['websocket'],
                    auth: { token: registerResponse.token },
                  });

                  searchSocket.on('connect', () => {
                    console.log(
                      'Connected to /search with registration token!',
                    );

                    searchSocket.emit(
                      'search',
                      { query: 'anon' },
                      (searchResponse) => {
                        console.log('Search response:', searchResponse);
                        searchSocket.disconnect();
                      },
                    );
                  });
                } else {
                  userSocket.disconnect();
                }
              }
            },
          );
        }, 1000);
      },
    );
  });

  userSocket.on('disconnect', () => {
    console.log('Disconnected from /users');
  });
}

main();
