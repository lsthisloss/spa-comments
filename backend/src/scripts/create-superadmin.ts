import { createConnection } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Post } from '../posts/entities/post.entity';
import { Comment } from '../comments/entities/comment.entity';
import { UserRole } from '../users/entities/user.entity';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

async function createSuperAdmin() {
  const connection = await createConnection({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'spa_comments',
    entities: [User, Post, Comment], // все связанные сущности
    synchronize: false,
  });

  const userRepository = connection.getRepository(User);

  // Проверяем, существует ли уже суперадмин
  const existingSuperAdmin = await userRepository.findOne({
    where: { role: UserRole.SUPERADMIN },
  });

  if (existingSuperAdmin) {
    console.log('SuperAdmin already exists!');
    console.log(`Email: ${existingSuperAdmin.email}`);
    console.log(`Username: ${existingSuperAdmin.userName}`);
    await connection.close();
    return;
  }

  // Генерируем данные
  const password = crypto.randomBytes(12).toString('hex');
  const email = 'admin@sk8.pw';
  const userName = 'Admin';
  const hashedPassword = await bcrypt.hash(password, 10);

  // Создаем суперадмина
  const superAdmin = userRepository.create({
    email: email,
    userName: userName,
    passwordHash: hashedPassword,
    role: UserRole.SUPERADMIN,
    slug: 'superadmin',
  });

  await userRepository.save(superAdmin);

  console.log('🎉 SuperAdmin created successfully!');
  console.log('================================');
  console.log(`Email: ${email}`);
  console.log(`Username: ${userName}`);
  console.log(`Password: ${password}`);
  console.log(`ID: ${superAdmin.id}`);
  console.log('================================');
  console.log('⚠️  SAVE THIS PASSWORD! It will not be shown again.');

  await connection.close();
}

createSuperAdmin().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
