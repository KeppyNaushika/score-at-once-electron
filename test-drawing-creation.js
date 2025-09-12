/**
 * @fileoverview DrawingAnnotation作成テストスクリプト
 * @description 外部キー制約違反をシミュレートして問題を特定
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testDrawingAnnotationCreation() {
  console.log('🧪 DrawingAnnotation作成テスト開始\n');

  try {
    // 1. 有効な外部キー値を取得
    const validQuestionScore = await prisma.questionScore.findFirst({
      select: { id: true, status: true }
    });
    
    const validUser = await prisma.user.findFirst({
      select: { id: true, username: true }
    });
    
    console.log('📋 テスト環境確認:');
    console.log(`  有効なQuestionScore: ${validQuestionScore ? validQuestionScore.id : '❌ なし'}`);
    console.log(`  有効なUser: ${validUser ? `${validUser.id} (${validUser.username})` : '❌ なし'}`);
    console.log();

    if (!validQuestionScore) {
      console.log('❌ QuestionScoreが存在しません。先にプロジェクトを作成してください。');
      return;
    }

    // 2. 正常ケースのテスト
    console.log('✅ テスト1: 正常なデータでの作成');
    try {
      const validTestData = {
        questionScoreId: validQuestionScore.id,
        type: 'text',
        x: 0.5,
        y: 0.5,
        text: 'テスト用アノテーション',
        color: '#ff0000',
        strokeWidth: 2,
        fontSize: 16,
        createdByUserId: validUser ? validUser.id : null
      };

      console.log('  作成データ:', validTestData);
      
      const validAnnotation = await prisma.drawingAnnotation.create({
        data: validTestData
      });
      
      console.log(`  ✅ 成功: ID ${validAnnotation.id} が作成されました`);
      
      // テスト用なので削除
      await prisma.drawingAnnotation.delete({
        where: { id: validAnnotation.id }
      });
      console.log('  🗑️  テスト用データを削除しました');
      
    } catch (error) {
      console.log('  ❌ 正常データでの作成に失敗:', error.message);
    }

    console.log();

    // 3. 無効なQuestionScoreIDのテスト
    console.log('❌ テスト2: 無効なQuestionScoreIDでの作成');
    try {
      const invalidQSData = {
        questionScoreId: 'invalid-question-score-id-12345',
        type: 'line',
        x: 0.1,
        y: 0.1,
        endX: 0.9,
        endY: 0.9,
        color: '#00ff00',
        strokeWidth: 3,
        createdByUserId: validUser ? validUser.id : null
      };

      console.log('  作成データ:', invalidQSData);
      
      await prisma.drawingAnnotation.create({
        data: invalidQSData
      });
      
      console.log('  ⚠️  期待に反して成功しました（これは問題です）');
      
    } catch (error) {
      console.log('  ✅ 期待通り失敗:', error.message);
      if (error.message.includes('Foreign key constraint')) {
        console.log('  🎯 外部キー制約違反を正しく検出しました');
      }
    }

    console.log();

    // 4. 無効なCreatedByUserIDのテスト
    console.log('❌ テスト3: 無効なCreatedByUserIDでの作成');
    try {
      const invalidUserData = {
        questionScoreId: validQuestionScore.id,
        type: 'rectangle',
        x: 0.2,
        y: 0.2,
        width: 0.3,
        height: 0.2,
        color: '#0000ff',
        strokeWidth: 1,
        createdByUserId: 'invalid-user-id-67890'
      };

      console.log('  作成データ:', invalidUserData);
      
      await prisma.drawingAnnotation.create({
        data: invalidUserData
      });
      
      console.log('  ⚠️  期待に反して成功しました（これは問題です）');
      
    } catch (error) {
      console.log('  ✅ 期待通り失敗:', error.message);
      if (error.message.includes('Foreign key constraint')) {
        console.log('  🎯 外部キー制約違反を正しく検出しました');
      }
    }

    console.log();

    // 5. null/undefinedテスト
    console.log('❓ テスト4: null/undefinedでの作成');
    try {
      const nullData = {
        questionScoreId: null,
        type: 'ellipse',
        x: 0.4,
        y: 0.4,
        width: 0.2,
        height: 0.1,
        color: '#ffff00',
        strokeWidth: 2,
        createdByUserId: null
      };

      console.log('  作成データ:', nullData);
      
      await prisma.drawingAnnotation.create({
        data: nullData
      });
      
      console.log('  ⚠️  nullデータで成功しました');
      
    } catch (error) {
      console.log('  ✅ nullデータで失敗:', error.message);
    }

    console.log('\n🏁 テスト完了');

  } catch (error) {
    console.error('💥 テスト実行エラー:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// スクリプト実行
if (require.main === module) {
  testDrawingAnnotationCreation().catch(console.error);
}

module.exports = { testDrawingAnnotationCreation };