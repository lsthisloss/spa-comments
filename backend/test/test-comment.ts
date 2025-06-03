import * as ioClient from 'socket.io-client';

const io = ioClient;
const userData = {
  email: 'anon2@example.com',
  userName: 'Anon2',
  password: 'Aa112233',
};

const COMMENTS_COUNT = 5;
const POST_ID = 'd8488f77-882e-4ddc-a66f-51c9a0bedbd3';
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
  const count = Math.max(1, Math.floor(length / 5)); // всегда хотя бы 1 слово!
  for (let i = 0; i < count; i++) {
    randomWords.push(words[Math.floor(Math.random() * words.length)]);
  }
  return randomWords.join(' ');
}

function main() {
  const userSocket = io('ws://localhost:3001/users', {
    transports: ['websocket'],
  });

  userSocket.on('connect', () => {
    console.log('Connected to /users namespace!');

    userSocket.emit('register', userData, (registerResponse) => {
      console.log('Ответ на register:', registerResponse);

      userSocket.emit(
        'login',
        { email: userData.email, password: userData.password },
        (loginResponse: {
          success: boolean;
          token?: string;
          user?: { id?: string };
        }) => {
          console.log('Ответ на login:', loginResponse);

          if (loginResponse.success && loginResponse.token) {
            userSocket.disconnect();

            const commentSocket = io('ws://localhost:3001/comments', {
              transports: ['websocket'],
              auth: { token: loginResponse.token },
            });

            commentSocket.on('connect', () => {
              console.log('Connected to /comments namespace!');

              let sent = 0;
              for (let i = 0; i < COMMENTS_COUNT; i++) {
                const text = randomText(Math.floor(Math.random() * 200) + 10); // минимум 10
                const commentDto = {
                  content:
                    text && text.trim().length > 0 ? text : 'test comment',
                  postId: POST_ID,
                  userId: loginResponse.user?.id,
                  userName: userData.userName,
                  imageUrl: null,
                };
                commentSocket.emit(
                  'addComment',
                  commentDto,
                  (commentResponse) => {
                    console.log(`Comment #${i + 1} response:`, commentResponse);
                    sent++;
                    if (sent === COMMENTS_COUNT) {
                      commentSocket.disconnect();
                    }
                  },
                  (error: Error) => {
                    console.error(`Error sending comment #${i + 1}:`, error);
                    sent++;
                    if (sent === COMMENTS_COUNT) {
                      commentSocket.disconnect();
                    }
                  },
                );
              }
            });

            commentSocket.on('disconnect', () => {
              console.log('Disconnected from /comments');
            });
          } else {
            console.error('Login failed:', loginResponse);
            userSocket.disconnect();
          }
        },
      );
    });
  });

  userSocket.on('disconnect', () => {
    console.log('Disconnected from /users');
  });
}

main();
