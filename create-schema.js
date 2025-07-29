const { PrismaClient } = require('@prisma/client');

async function createSchema() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔄 スキーマ作成開始...');
    
    // テスト接続
    await prisma.$connect();
    console.log('✅ データベース接続成功');
    
    // テーブル確認
    const tables = await prisma.$queryRaw`
      SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '_test'
    `;
    console.log('📋 現在のテーブル:', tables);
    
    if (tables.length === 0) {
      console.log('❌ テーブルが見つかりません。手動でスキーマを作成する必要があります。');
      
      // 手動でテーブル作成
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "User" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "username" TEXT NOT NULL UNIQUE,
          "name" TEXT NOT NULL,
          "role" TEXT NOT NULL DEFAULT 'teacher',
          "passcode" TEXT,
          "passcodeType" TEXT DEFAULT 'none',
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      console.log('✅ Userテーブル作成完了');
      
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "CropRegion" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "projectId" TEXT NOT NULL,
          "masterImageId" TEXT NOT NULL,
          "label" TEXT NOT NULL,
          "type" TEXT NOT NULL,
          "x" REAL NOT NULL,
          "y" REAL NOT NULL,
          "width" REAL NOT NULL,
          "height" REAL NOT NULL,
          "points" INTEGER,
          "orderIndex" INTEGER,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      console.log('✅ CropRegionテーブル作成完了');
      
      // 他の重要なテーブルも作成...
      
      const finalTables = await prisma.$queryRaw`
        SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '_test'
      `;
      console.log('📋 作成後のテーブル:', finalTables);
    }
    
  } catch (error) {
    console.error('❌ エラー:', error);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  createSchema();
}

module.exports = { createSchema };