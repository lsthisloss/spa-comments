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

async function createSuperAdmin() {
  console.log('🚀 Starting SuperAdmin creation...');

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'spa_comments',
    entities: [User, Post, Comment],
    synchronize: false,
  });

  try {
    await dataSource.initialize();
    console.log('✅ Database connected successfully');

    const userRepository = dataSource.getRepository(User);

    // Проверяем, существует ли уже суперадмин
    const existingSuperAdmin = await userRepository.findOne({
      where: { role: UserRole.SUPERADMIN },
    });

    if (existingSuperAdmin) {
      console.log('⚠️  SuperAdmin already exists!');
      console.log(`   Email: ${existingSuperAdmin.email}`);
      console.log(`   Username: ${existingSuperAdmin.userName}`);
      console.log(`   ID: ${existingSuperAdmin.id}`);

      // Опционально: обновить существующего пользователя
      if (process.env.FORCE_UPDATE === 'true') {
        console.log('🔄 FORCE_UPDATE enabled, updating existing SuperAdmin...');
        const newPassword =
          process.env.SUPERADMIN_PASSWORD || randomBytes(12).toString('hex');
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await userRepository.update(existingSuperAdmin.id, {
          passwordHash: hashedPassword,
          email: process.env.SUPERADMIN_EMAIL || existingSuperAdmin.email,
          userName:
            process.env.SUPERADMIN_USERNAME || existingSuperAdmin.userName,
        });

        console.log('✅ SuperAdmin updated successfully!');
        console.log(`   New Password: ${newPassword}`);
      } else {
        console.log('💡 Use FORCE_UPDATE=true to update existing SuperAdmin');
      }

      await dataSource.destroy();
      return;
    }

    // Используем переменные окружения или генерируем случайные данные
    const password =
      process.env.SUPERADMIN_PASSWORD || randomBytes(12).toString('hex');
    const email = process.env.SUPERADMIN_EMAIL || 'admin@sk8.pw';
    const userName = process.env.SUPERADMIN_USERNAME || 'SuperAdmin';
    const hashedPassword = await bcrypt.hash(password, 10);

    console.log('🔧 Creating SuperAdmin with:');
    console.log(`   Email: ${email}`);
    console.log(`   Username: ${userName}`);

    // Создаем суперадмина
    const superAdmin = userRepository.create({
      email: email,
      userName: userName,
      passwordHash: hashedPassword,
      role: UserRole.SUPERADMIN,
      slug: userName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    });

    await userRepository.save(superAdmin);

    console.log('\n🎉 SuperAdmin created successfully!');
    console.log('================================');
    console.log(`Email: ${email}`);
    console.log(`Username: ${userName}`);
    console.log(`Password: ${password}`);
    console.log(`ID: ${superAdmin.id}`);
    console.log('================================');
    console.log('⚠️  SAVE THIS PASSWORD! It will not be shown again.');

    await dataSource.destroy();
    console.log('✅ Database connection closed');
  } catch (error: unknown) {
    console.error('❌ Script failed:', error);

    if (error && typeof error === 'object' && 'code' in error) {
      const typedError = error as { code: string };
      if (typedError.code === 'ECONNREFUSED') {
        console.error(
          '🚫 Cannot connect to database. Make sure PostgreSQL is running.',
        );
      } else if (typedError.code === '23505') {
        console.error('🚫 User with this email or username already exists.');
      }
    }

    // Закрываем соединение в случае ошибки
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }

    process.exit(1);
  }
}

createSuperAdmin().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
