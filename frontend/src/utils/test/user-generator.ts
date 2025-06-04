
import io from 'socket.io-client';
import { randomUserName } from '../generators';
import { TestConfig } from './config';
import { testService } from '../../services/test/TestService';

export interface UserCreationResult {
  success: boolean;
  user?: {
    id: string;
    userName: string;
    token: string;
  };
  error?: string;
}

interface PostMedia {
  name: string;
  type: string;
  base64: string;
}

interface PostData {
  content: string;
  userId: string;
  userName: string;
  image?: PostMedia;
  file?: PostMedia;
}

export interface PostCreationStats {
  created: number;
  queued: number;
  rateLimited: number;
  errors: number;
}

export class TestUserGenerator {
  private config: TestConfig;
  private saveToDatabase: boolean;

  constructor(config: TestConfig, saveToDatabase: boolean = true) {
    this.config = config;
    this.saveToDatabase = saveToDatabase;
    
    if (saveToDatabase) {
      console.log(`💾 Real mode: data will be saved to database`);
    } else {
      console.log(`⚡ Test mode: using mock data, no database saves`);
      testService.setTestEnvironment(config);
    }
  }

  async createUser(userIndex: number, prefix = 'testuser'): Promise<UserCreationResult> {
    const userName = randomUserName();
    const userData = {
      email: `${prefix}_${Date.now()}_${userIndex}@sk8.pw`,
      userName,
      password: 'asdyt1Aq4edf*',
    };

    console.log(`🧑 Creating user ${userIndex}: ${userData.userName} ${this.saveToDatabase ? '(REAL MODE)' : '(TEST MODE)'}`);

    return new Promise((resolve, reject) => {
      // Настройки сокета с флагом для тестовых данных
      const socketOptions = this.saveToDatabase 
        ? { 
            query: {
              testDataGeneration: 'true' // Флаг для обхода ограничений
            }
          }
        : testService.getTestSocketOptions();
      
      const userSocket = io(`${this.config.socketURL}/users`, socketOptions);

      const operationTimeout = setTimeout(() => {
        console.error(`⏰ Operation timeout for user ${userData.userName}`);
        userSocket.disconnect();
        reject(new Error('Operation timeout'));
      }, this.config.timeouts.operation);

      userSocket.on('connect', () => {
        console.log(`✅ Connected to /users for ${userData.userName} (testDataGeneration: ${this.saveToDatabase ? 'true' : 'test'})`);

        // Добавляем флаг тестовых данных в userData
        const registrationData = {
          ...userData,
          testDataGeneration: this.saveToDatabase, // Флаг для серверной обработки
        };

        userSocket.emit('register', registrationData, async (registerResponse: {
          token?: string;
          user?: { id?: string };
          message?: string;
          success?: boolean;
        }) => {
          try {
            if (registerResponse.success && registerResponse.token && registerResponse.user?.id) {
              console.log(`📝 User ${userData.userName} registered successfully with ID: ${registerResponse.user.id}`);

              // Дополнительная проверка пользователя через API
              if (this.saveToDatabase) {
                try {
                  const response = await fetch(`${this.config.socketURL.replace('ws://', 'http://').replace('wss://', 'https://')}/api/users/${userData.userName}`, {
                    headers: {
                      'Authorization': `Bearer ${registerResponse.token}`
                    }
                  });
                  
                  if (response.ok) {
                    const userProfile = await response.json();
                    console.log(`✅ User ${userData.userName} verified in database:`, userProfile.id);
                  } else {
                    console.warn(`⚠️ Could not verify user ${userData.userName} in database`);
                  }
                } catch (verifyError) {
                  console.warn(`⚠️ User verification failed for ${userData.userName}:`, verifyError);
                }
              }

              userSocket.disconnect();
              clearTimeout(operationTimeout);

              resolve({
                success: true,
                user: {
                  id: registerResponse.user.id,
                  userName: userData.userName,
                  token: registerResponse.token,
                },
              });
            } else {
              console.error(`❌ Registration failed for ${userData.userName}:`, registerResponse.message);
              userSocket.disconnect();
              clearTimeout(operationTimeout);
              resolve({
                success: false,
                error: registerResponse.message || 'Registration failed',
              });
            }
          } catch (error) {
            console.error(`❌ Error processing registration for ${userData.userName}:`, error);
            userSocket.disconnect();
            clearTimeout(operationTimeout);
            reject(error);
          }
        });
      });

      userSocket.on('connect_error', (error: Error) => {
        console.error(`❌ Users socket connection error for ${userData.userName}:`, error.message);
        clearTimeout(operationTimeout);
        reject(error);
      });

      userSocket.on('disconnect', (reason: unknown) => {
        console.log(`🔌 User socket disconnected for ${userData.userName}:`, reason);
      });
    });
  }
  /**
   * Генерация простого поста без сложных медиа-файлов
   */
  private generateSimplePost(postIndex: number, userId: string, userName: string): PostData {
    const contentVariants = [
      `<b>Наруто vs Гоку</b> - вечный спор! 🥊 Кто сильнее физически? Лично я считаю что <i>Гоку</i> побеждает в чистой силе, но <u>Наруто</u> превосходит в тактике и хитрости. 

<code>Расенган против Камехамехи</code> было бы эпично! 💥 Представляете как они тренируются вместе? Гоку учит Наруто контролировать энергию, а Наруто показывает силу дружбы! 

Оба начинали слабыми, но упорство привело их к вершинам. В этом красота <i>shounen</i> аниме! 🌟`,

      `<b>Японская культура чая</b> просто завораживает! 🍵 Вчера попробовал настоящую <code>чайную церемонию</code> - это медитация в движении. 

Каждый жест имеет значение, каждая деталь продумана веками. <i>Матча</i> горьковатый, но после него ощущаешь невероятную ясность ума! 🧘‍♂️ 

В <u>Японии</u> даже простое чаепитие превращается в искусство. Хочу изучить все тонкости этой традиции. Может кто-то знает хорошие места для обучения? 🏮`,

      `<b>Саске Учиха</b> - самый сложный персонаж! 😤 От друга до врага, от мести к искуплению... Его путь показывает как боль может изменить человека. 

<code>Шаринган и Риннеган</code> делают его невероятно мощным, но настоящая сила - в преодолении ненависти. ⚡ 

<i>Чидори против Расенгана</i> навсегда останется легендарным! Эта битва не о силе, а о разных путях к одной цели. Наруто и Саске - две стороны одной медали! 👁️`,

      `<b>Сакура в Японии</b> - это нечто магическое! 🌸 Только что увидел фото <i>ханами</i> из Киото... розовые лепестки падают как снег! 

<u>Японцы</u> умеют находить красоту в мимолетном. <code>Моно но аварэ</code> - философия печальной красоты увядания. 🌺 

Мечтаю попасть в <i>Японию</i> во время цветения! Говорят, что пикники под сакурой - это особая традиция. Кто-нибудь был там весной? Поделитесь впечатлениями! 🏮`,

      `<b>Гоку против Джирена</b> - лучшая битва в Dragon Ball Super! 💪 <code>Ультра Инстинкт</code> - это не просто трансформация, это философия боя! 

Когда разум молчит, тело движется само. 🧘‍♂️ Эта техника показывает эволюцию Гоку от дикого бойца до просветленного воина. 

Серебряные волосы и божественная аура! ✨ Жаль только, что он не смог удержать эту форму долго. Но сама идея пустого разума очень <u>дзенская</u>! 🔥`,

      `<b>Японская каллиграфия</b> просто завораживает! ✍️ Начал изучать <code>сёдо</code> - это медитация через письмо. Каждый штрих кисти имеет душу! 

<i>Иероглифы</i> - это не просто символы, это целые истории! 🖋️ Особенно люблю писать <u>禅</u> (дзэн) - в нем такая гармония линий! 

В <i>Японии</i> красивый почерк считается признаком культурного человека. Хочу достичь уровня, когда мои иероглифы станут произведением искусства! 🎨`,

      `<b>Дружба в аниме</b> - это особая тема! 👫 <i>Наруто и Саске</i>, <i>Гоку и Вегета</i>, <i>Луффи и Зоро</i>... Эти отношения строятся через соперничество! 

В <u>Японии</u> есть понятие <code>накама</code> - друг-товарищ, готовый на все! 💯 В реальной жизни редко встретишь такую преданность. 

Аниме учит нас ценить тех, кто рядом, и никогда не сдаваться ради друзей! 🌟 Какая пара друзей в аниме вам ближе всего? 💙`,

      `<b>Техники Наруто vs техники Гоку</b> - кто разнообразнее? 🤔 У <i>Наруто</i>: <code>Расенган</code>, <code>Каге Буншин</code>, <code>Сеннин мод</code>... 

У <i>Гоку</i>: <code>Камехамеха</code>, <code>Кайокен</code>, формы <code>Супер Сайяна</code>! 💥 Наруто больше полагается на хитрость, Гоку - на чистую мощь. 

Представляете кроссовер, где они тренируются вместе? <u>Мастер Роши</u> учит Наруто, а <u>Джирайя</u> тренирует Гоку! Эпично было бы! 🔥`,

      `<b>Японская еда</b> - это отдельная вселенная! 🍜 Только что попробовал настоящий <code>тонкоцу рамен</code> - бульон варился 12 часов! 

<i>Японцы</i> превращают простую лапшу в произведение искусства! 🍥 Каждый ингредиент имеет значение: <u>чашу</u>, <u>яйцо</u>, <u>водоросли</u>... 

Особенно впечатляет <code>омакасе</code> - когда шеф сам выбирает блюда! Доверие между поваром и гостем - основа японской кухни! 🍣`,

      `<b>Арка Чунин экзаменов</b> в Наруто была идеальной! 📚 Каждый персонаж показал свой рост и уникальность. <i>Наруто</i> учился контролировать <code>Курама</code>. 

<i>Саске</i> пробудил проклятую печать, <i>Сакура</i> поняла свою слабость. 💪 Битва с <u>Гаарой</u> показала, что сила без друзей - пустота! 

<code>Орочимару</code> как антагонист был на высоте! 🐍 Эта арка идеально показала философию ниндзя и важность связей между людьми! 🥷`,

      `<b>Философия дзен</b> в повседневной жизни! 🧘‍♂️ <i>Японцы</i> находят гармонию в простых вещах: <code>садоводство</code>, <code>чаепитие</code>, <code>каллиграфия</code>... 

Концепция <u>ваби-саби</u> учит видеть красоту в несовершенстве! 🌿 Треснувшая чашка может быть прекраснее новой, если в ней есть история. 

В <i>аниме</i> тоже часто показывают эту философию. Даже <u>Наруто</u> учился находить покой через медитацию! ⛩️`,

      `<b>Вегета</b> - лучшее развитие персонажа! 👑 От гордого <i>принца Сайян</i> до заботливого отца и защитника Земли. Его путь впечатляет! 

<code>"Моя Булма!"</code> - этот момент показал его человечность! 💎 Упрямство и гордость одновременно его сила и слабость. 

Хотя <u>Гоку</u> сильнее, Вегета остается фаворитом за характер! 🔥 В нем есть что-то от самурайской чести и принципов! 💙`,

      `<b>Традиционные японские фестивали</b> просто волшебные! 🏮 <i>Танабата</i>, <i>Омацури</i>, <i>Ханами</i>... каждый имеет глубокий смысл! 

Особенно люблю <code>юката</code> и <code>фейерверки</code> летом! 🎆 <u>Японцы</u> умеют создавать атмосферу праздника из простых вещей. 

В <i>аниме</i> часто показывают эти фестивали - они всегда такие душевные и красивые! Хочу попасть на настоящий <u>мацури</u>! 🎭`,

      `<b>Саундтреки аниме</b> - отдельная вселенная! 🎵 <code>Naruto Main Theme</code> заставляет почувствовать себя ниндзя! <code>Cha-La Head-Cha-La</code> дает энергию! 

Музыка не просто фон - она усиливает эмоции в тысячи раз! ⚡ Когда играет <i>Sadness and Sorrow</i>, слезы наворачиваются сами... 😢 

<u>Японские</u> композиторы гении! Они создают мелодии, которые остаются в сердце навсегда! 🎼`,

      `<b>Итачи Учиха</b> - самый трагичный персонаж! 😢 Убил весь клан ради мира, позволил брату ненавидеть себя... Истинный герой в тени! 

<code>Цукуёми</code>, <code>Аматэрасу</code>, <code>Сусаноо</code> - техники уровня богов! 👁️ <i>"Прости, Саске... это последний раз"</i> - до сих пор мурашки! 

Настоящий <u>ниндзя</u> тот, кто жертвует всем ради других, оставаясь непонятым. Итачи воплощение самурайской чести! 💔`,

      `<b>Японское искусство</b> минимализма завораживает! 🎨 <i>Сады камней</i>, <code>икебана</code>, <code>оригами</code>... красота в простоте! 

Каждый элемент имеет значение, лишнего нет! 🌸 <u>Японцы</u> мастера создавать гармонию из малого. Это очень <i>дзенский</i> подход! 

В <code>аниме</code> тоже часто используют этот принцип - важные моменты показывают через детали, а не спецэффекты! ⛩️`,

      `<b>Режим Мудреца Наруто</b> - чистое совершенство! 🐸 Оранжевая раскраска вокруг глаз, спокойствие вместо хаоса, мудрость вместо импульсивности! 

Этот режим показал рост <i>Наруто</i> как воина и человека! 🧘‍♂️ <code>Природная энергия + чакра = баланс</code> между силой и контролем. 

Философия <u>лягушек</u> с горы Мёбоку очень <i>буддистская</i>! Жаль, что время ограничено, но это делает форму особенной! 🌿`,

      `<b>Король Пиратов Роджер</b> изменил мир одной фразой! 🏴‍☠️ <code>"Мое сокровище? Ищите! Я оставил все в том месте!"</code> 

Эти слова запустили <i>Великую Эпоху Пиратства</i>! 🌊 <u>One Piece</u> не просто сокровище - это мечта, свобода, дружба, приключения! 

<i>Луффи</i> идет по стопам Роджера, но создает свою легенду! В этом дух <u>японского</u> понимания наследования традиций! 🌟`,

      `<b>Арка Фриза</b> навсегда изменила аниме! 🪐 <i>Намек</i>, смерть <i>Криллина</i>, первая трансформация <code>Супер Сайяна</code>... эмоциональные горки! 

<u>Фриза</u> остается лучшим злодеем - холодный, жестокий, но харизматичный! ❄️ Его возвращение в Super доказало популярность! 

Момент трансформации <i>Гоку</i> стал иконичным для всей <u>японской</u> поп-культуры! Золотые волосы знают даже те, кто не смотрел аниме! 👑`
    ];

    // Просто берем контент без добавления лишнего
    const content = contentVariants[postIndex % contentVariants.length];

    const postData: PostData = {
      content,
      userId,
      userName,
    };

    // Добавляем аниме-изображение в 40% случаев  
    if (Math.random() < 0.4) {
      const animeImage = this.generateAnimeImage(postIndex);
      postData.image = {
        name: animeImage.name,
        type: animeImage.type,
        base64: animeImage.base64,
      };
      console.log(`🖼️ Adding anime image to post: ${animeImage.name}`);
    }

    return postData;
  }

  /**
   * Генерация аниме-тематического изображения
   */
  private generateAnimeImage(index: number): { name: string; type: string; base64: string } {
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Cannot create canvas context');
    }
    
    // Аниме темы
    const themes = [
      { name: 'Naruto', bg: ['#FF6B35', '#F7931E'], emoji: '🍜', text: 'ナルト' },
      { name: 'Goku', bg: ['#1E3A8A', '#3B82F6'], emoji: '⚡', text: '悟空' },
      { name: 'Sasuke', bg: ['#5B21B6', '#8B5CF6'], emoji: '👁️', text: 'サスケ' },
      { name: 'OnePiece', bg: ['#0369A1', '#0EA5E9'], emoji: '🏴‍☠️', text: '海賊' },
      { name: 'AttackTitan', bg: ['#DC2626', '#EF4444'], emoji: '⚔️', text: '進撃' }
    ];
    
    const theme = themes[index % themes.length];
    
    // Создаем градиент
    const gradient = ctx.createRadialGradient(150, 150, 0, 150, 150, 150);
    gradient.addColorStop(0, theme.bg[0]);
    gradient.addColorStop(1, theme.bg[1]);
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 300, 300);
    
    // Добавляем эффекты
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    for (let i = 0; i < 10; i++) {
      const x = Math.random() * 300;
      const y = Math.random() * 300;
      ctx.beginPath();
      ctx.arc(x, y, Math.random() * 20 + 5, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Большой эмодзи
    ctx.font = '80px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 10;
    ctx.fillText(theme.emoji, 150, 120);
    
    // Японский текст
    ctx.font = 'bold 40px Arial';
    ctx.fillText(theme.text, 150, 180);
    
    // Название на английском
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = '#FFE066';
    ctx.fillText(theme.name, 150, 220);
    
    // Номер
    ctx.font = '16px Arial';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText(`#${index + 1}`, 150, 260);
    
    const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
    
    return {
      name: `anime_${theme.name.toLowerCase()}_${index + 1}.jpg`,
      type: 'image/jpeg',
      base64,
    };
  }
  async createPostsWithMedia(
    userName: string,
    token: string,
    userId: string,
    postsCount: number,
    mode: 'normal' | 'crash' = 'normal'
  ): Promise<PostCreationStats> {
    const modeConfig = this.config.modes[mode];

    return new Promise((resolve, reject) => {
      // Настройки сокета для реального режима с обходом CAPTCHA
      const socketOptions = this.saveToDatabase 
        ? { 
            auth: { token },
            query: {
              testDataGeneration: 'true' // Флаг для обхода CAPTCHA и rate limit
            }
          }
        : {
            ...testService.getTestSocketOptions(),
            query: {
              ...testService.getTestSocketOptions().query,
              crashTest: mode === 'crash' ? 'true' : 'false'
            },
            auth: { token }
          };
      
      const postSocket = io(`${this.config.socketURL}/posts`, socketOptions);

      const stats: PostCreationStats = {
        created: 0,
        queued: 0,
        rateLimited: 0,
        errors: 0,
      };

      const startTime = Date.now();

      const cleanup = () => {
        postSocket.disconnect();
        const duration = Math.round((Date.now() - startTime) / 1000);
        console.log(`⏱️ ${userName} completed in ${duration}s`);
        console.log(`📊 ${userName} STATS: ✅${stats.created} 📦${stats.queued} 🚫${stats.rateLimited} ❌${stats.errors}`);
        resolve(stats);
      };

      const checkCompletion = () => {
        const total = stats.created + stats.queued + stats.rateLimited + stats.errors;
        if (total >= postsCount) {
          setTimeout(cleanup, 500);
        }
      };

      postSocket.on('connect', async () => {
        console.log(`📡 ${userName}: Connected to /posts (${mode} mode, ${this.saveToDatabase ? 'REAL DB' : 'TEST'} )`);

        // Создаем посты с интервалами
        for (let j = 0; j < postsCount; j++) {
          const delayMs = mode === 'crash'
            ? j * modeConfig.delayBetweenPosts
            : modeConfig.delayBetweenPosts + (Math.random() * modeConfig.delayVariation);

          setTimeout(() => {
            if (!postSocket.connected) {
              stats.errors++;
              checkCompletion();
              return;
            }

            const postData = this.generateSimplePost(j, userId, userName);

            console.log(`📤 ${userName}: Sending post ${j + 1}/${postsCount}`);

            postSocket.emit('addPost', postData, (postResponse: {
              success: boolean;
              message: string;
              postId?: string;
              queued?: boolean;
              rateLimited?: boolean;
              retryAfter?: number;
              currentCount?: number;
              maxPosts?: number;
            }) => {
              if (postResponse.success) {
                if (postResponse.queued) {
                  stats.queued++;
                  console.log(`📦 ${userName}: Post ${j + 1} → QUEUE`);
                } else {
                  stats.created++;
                  console.log(`✅ ${userName}: Post ${j + 1} → CREATED`);
                }
              } else {
                if (postResponse.rateLimited || postResponse.message.includes('Rate limit')) {
                  stats.rateLimited++;
                  console.log(`🚫 ${userName}: Post ${j + 1} → RATE LIMITED`);
                } else {
                  stats.errors++;
                  console.log(`❌ ${userName}: Post ${j + 1} → ERROR: ${postResponse.message}`);
                }
              }
              checkCompletion();
            });
          }, delayMs);
        }

        // Таймаут безопасности
        setTimeout(() => {
          const total = stats.created + stats.queued + stats.rateLimited + stats.errors;
          if (total < postsCount) {
            console.warn(`⚠️ ${userName}: Force completion ${total}/${postsCount}`);
            cleanup();
          }
        }, this.config.timeouts.operation * modeConfig.timeoutMultiplier);
      });

      postSocket.on('connect_error', (error: Error) => {
        console.error(`❌ ${userName}: Posts socket error:`, error.message);
        reject(error);
      });
    });
  }
}