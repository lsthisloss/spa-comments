/**
 *  генератор тестовых данных 
 */

import { TestUserGenerator } from './user-generator';
import { crashTestQueue } from './crash-test';
import { DEFAULT_CONFIG } from './config';

// добавлен параметр generateWithMedia
export async function generateTestData(
  usersCount: number,
  postsPerUser: number,
  saveToDatabase: boolean = true,
  generateWithMedia: boolean = true
): Promise<void> {
  const mediaText = generateWithMedia ? 'with images and files' : 'text only';
  
  console.log(`🚀 Starting SIMPLIFIED ${saveToDatabase ? 'REAL' : 'TEST'} data generation`);
  console.log(`👥 Users: ${usersCount} × 📝 Posts: ${postsPerUser} = ${usersCount * postsPerUser} total`);
  console.log(`📡 Socket URL: ${DEFAULT_CONFIG.socketURL}`);
  console.log(`💾 Save to database: ${saveToDatabase ? 'YES' : 'NO'}`);
  console.log(`📷 Media generation: ${generateWithMedia ? 'ENABLED (images + files)' : 'DISABLED (text only)'}`);
  
  const startTime = Date.now();
  const BATCH_SIZE = Math.min(DEFAULT_CONFIG.limits.batchSize, 2);
  let totalSuccess = 0;
  let totalErrors = 0;
  
  // передаем параметр медиа в конструктор
  const userGenerator = new TestUserGenerator(DEFAULT_CONFIG, saveToDatabase, generateWithMedia);
  
  try {
    // Обрабатываем пользователей по батчам
    for (let i = 0; i < usersCount; i += BATCH_SIZE) {
      const batchEnd = Math.min(i + BATCH_SIZE, usersCount);
      const batch = [];
      
      console.log(`\n📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}: users ${i + 1}-${batchEnd} (${mediaText})`);
      
      // Создаем промисы для текущего батча
      for (let j = i; j < batchEnd; j++) {
        batch.push(
          userGenerator.createUser(j, 'testuser')
            .then(async (userResult) => {
              if (userResult.success && userResult.user) {
                // Создаем посты
                await userGenerator.createPostsWithMedia(
                  userResult.user.userName,
                  userResult.user.token,
                  userResult.user.id,
                  postsPerUser,
                  'normal'
                );
                totalSuccess++;
                console.log(`✅ User ${j + 1} completed successfully`);
              } else {
                totalErrors++;
                console.error(`❌ User ${j + 1} failed: ${userResult.error}`);
              }
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
        console.log(`⏳ Waiting ${DEFAULT_CONFIG.delays.betweenBatches}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, DEFAULT_CONFIG.delays.betweenBatches));
      }
    }
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n🎉 SIMPLIFIED ${saveToDatabase ? 'REAL' : 'TEST'} data generation completed in ${duration} seconds!`);
    console.log(`📊 Results: ${totalSuccess} successful, ${totalErrors} failed`);
    console.log(`📷 Media: ${generateWithMedia ? 'Images and files generated' : 'Text only mode'}`);
    
    if (saveToDatabase) {
      console.log(`💾 All data saved to PostgreSQL database!`);
      console.log(`🔄 Refresh the page to see your new test data`);
    } else {
      console.log(`⚡ Test mode - no database changes made`);
    }
    
  } catch (error) {
    console.error('❌ Simplified test data generation failed:', error);
  }
}

export { crashTestQueue };