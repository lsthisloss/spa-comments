import { DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Post } from '../posts/entities/post.entity';
import { Comment } from '../comments/entities/comment.entity';
import { UserRole } from '../users/entities/user.entity';
import * as bcrypt from 'bcrypt';
import { randomBytes } from '../utils/crypto';
import * as dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

const isDev = process.env.NODE_ENV === 'development';

async function createSuperAdmin() {
  console.log('🚀 Starting SuperAdmin creation...');
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);

  // Определяем хост базы данных в зависимости от окружения
  const dbHost = isDev ? 'postgres-dev' : process.env.DB_HOST || 'postgres';

  console.log(
    `🗄️  Database: ${dbHost}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'spa_comments'}`,
  );

  const dataSource = new DataSource({
    type: 'postgres',
    host: dbHost,
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'spa_comments',
    entities: [User, Post, Comment],
    synchronize: false,
    // Настройки для dev/prod
    connectTimeoutMS: isDev ? 60000 : 30000,
    extra: {
      max: 1,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: isDev ? 60000 : 30000,
    },
    logging: isDev ? ['error', 'warn'] : false,
  });

  try {
    console.log('🔌 Connecting to database...');
    await dataSource.initialize();
    console.log('✅ Database connected successfully');

    const userRepository = dataSource.getRepository(User);

    // Проверяем, существует ли уже суперадмин
    console.log('🔍 Checking for existing SuperAdmin...');
    const existingSuperAdmin = await userRepository.findOne({
      where: { role: UserRole.SUPERADMIN },
    });

    if (existingSuperAdmin) {
      console.log('⚠️  SuperAdmin already exists!');
      console.log(`   Email: ${existingSuperAdmin.email}`);
      console.log(`   Username: ${existingSuperAdmin.userName}`);
      console.log(`   ID: ${existingSuperAdmin.id}`);

      // В dev режиме автоматически обновляем если нет FORCE_UPDATE
      const shouldUpdate = process.env.FORCE_UPDATE === 'true' || isDev;

      if (shouldUpdate) {
        console.log(
          `🔄 ${isDev ? 'DEV mode' : 'FORCE_UPDATE'} enabled, updating existing SuperAdmin...`,
        );

        // Дефолтные значения для dev
        const defaultEmail = isDev ? 'dev@sk8.pw' : 'dev@sk8.pw';
        const defaultUsername = isDev ? 'DevAdmin' : 'SuperAdmin';

        const newPassword =
          process.env.SUPERADMIN_PASSWORD || randomBytes(12).toString('hex');
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await userRepository.update(existingSuperAdmin.id, {
          passwordHash: hashedPassword,
          email: process.env.SUPERADMIN_EMAIL || defaultEmail,
          userName: process.env.SUPERADMIN_USERNAME || defaultUsername,
        });

        console.log('✅ SuperAdmin updated successfully!');
        console.log(`   New Password: ${newPassword}`);
      } else {
        console.log('💡 Use FORCE_UPDATE=true to update existing SuperAdmin');
      }

      await dataSource.destroy();
      return;
    }

    // Дефолтные значения для dev/prod
    const defaultEmail = isDev ? 'dev@sk8.pw' : 'admin@sk8.pw';
    const defaultUsername = isDev ? 'DevAdmin' : 'SuperAdmin';
    const defaultPassword = isDev
      ? 'dev123456'
      : randomBytes(12).toString('hex');

    // Используем переменные окружения или дефолтные значения
    const password = process.env.SUPERADMIN_PASSWORD || defaultPassword;
    const email = process.env.SUPERADMIN_EMAIL || defaultEmail;
    const userName = process.env.SUPERADMIN_USERNAME || defaultUsername;

    console.log('🔧 Creating SuperAdmin with:');
    console.log(`   Email: ${email}`);
    console.log(`   Username: ${userName}`);

    // Создаем хеш пароля
    console.log('🔐 Hashing password...');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Генерируем slug
    const slug = userName.toLowerCase().replace(/[^a-z0-9]/g, '-');

    // Проверяем уникальность email и username
    console.log('🔍 Checking email and username uniqueness...');
    const existingByEmail = await userRepository.findOne({ where: { email } });
    const existingByUsername = await userRepository.findOne({
      where: { userName },
    });

    if (existingByEmail) {
      console.error(`❌ User with email ${email} already exists!`);
      await dataSource.destroy();
      process.exit(1);
    }

    if (existingByUsername) {
      console.error(`❌ User with username ${userName} already exists!`);
      await dataSource.destroy();
      process.exit(1);
    }

    // Создаем суперадмина
    console.log('👤 Creating SuperAdmin user...');
    const superAdmin = userRepository.create({
      email: email,
      userName: userName,
      passwordHash: hashedPassword,
      role: UserRole.SUPERADMIN,
      slug: slug,
    });

    const savedUser = await userRepository.save(superAdmin);

    console.log('\n🎉 SuperAdmin created successfully!');
    console.log('================================');
    console.log(`Email: ${email}`);
    console.log(`Username: ${userName}`);
    console.log(`Password: ${password}`);
    console.log(`ID: ${savedUser.id}`);
    console.log(`Slug: ${savedUser.slug}`);
    console.log(`Environment: ${isDev ? 'DEVELOPMENT' : 'PRODUCTION'}`);
    console.log('================================');

    if (!isDev) {
      console.log('⚠️  SAVE THIS PASSWORD! It will not be shown again.');
    } else {
      console.log('💡 Development mode - password is saved for convenience');
    }

    await dataSource.destroy();
    console.log('✅ Database connection closed');
  } catch (error: unknown) {
    console.error('❌ Script failed:', error);

    if (error && typeof error === 'object') {
      if ('code' in error) {
        const typedError = error as { code: string; message?: string };

        switch (typedError.code) {
          case 'ECONNREFUSED':
            console.error(
              '🚫 Cannot connect to database. Make sure PostgreSQL is running.',
            );
            if (isDev) {
              console.error(
                '💡 For dev: docker-compose -f docker-compose.dev.yml up -d postgres',
              );
            } else {
              console.error(
                '💡 For prod: docker-compose -f docker-compose.prod.yml up -d postgres',
              );
            }
            break;
          case 'ENOTFOUND':
            console.error(
              '🚫 Database host not found. Check DB_HOST environment variable.',
            );
            console.error(`💡 Current DB_HOST: ${dbHost}`);
            console.error(
              `💡 Expected: ${isDev ? 'postgres-dev' : 'postgres'} (container name)`,
            );
            break;
          case '23505':
            console.error(
              '🚫 User with this email or username already exists.',
            );
            break;
          case '3D000':
            console.error(
              '🚫 Database does not exist. Make sure the database is created.',
            );
            break;
          case '28P01':
            console.error(
              '🚫 Authentication failed. Check database credentials.',
            );
            console.error(
              `💡 Current credentials: ${process.env.DB_USER || 'postgres'}@${dbHost}`,
            );
            break;
          default:
            console.error(
              `🚫 Database error (${typedError.code}): ${typedError.message || 'Unknown error'}`,
            );
        }
      } else if ('message' in error) {
        console.error(`🚫 Error: ${(error as Error).message}`);
      }
    }

    // Закрываем соединение в случае ошибки
    if (dataSource.isInitialized) {
      try {
        await dataSource.destroy();
        console.log('🔌 Database connection closed');
      } catch (closeError) {
        console.error('❌ Failed to close database connection:', closeError);
      }
    }

    process.exit(1);
  }
}

// Обработка сигналов для graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Process interrupted, exiting...');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Process terminated, exiting...');
  process.exit(1);
});

createSuperAdmin().catch((error) => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});
