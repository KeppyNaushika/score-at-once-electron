/**
 * @fileoverview DrawingAnnotation外部キー制約デバッグスクリプト
 * @description 外部キー制約違反の原因を特定するためのデバッグツール
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugForeignKeyConstraints() {
  console.log('🔍 DrawingAnnotation外部キー制約デバッグ開始\n');

  try {
    // 1. QuestionScore テーブルの状態確認
    console.log('📊 QuestionScore テーブル統計:');
    const questionScoreCount = await prisma.questionScore.count();
    console.log(`  総レコード数: ${questionScoreCount}`);
    
    if (questionScoreCount > 0) {
      const questionScores = await prisma.questionScore.findMany({
        take: 5,
        select: {
          id: true,
          status: true,
          studentId: true,
          cropRegionId: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' }
      });
      
      console.log('  最新の5件:');
      questionScores.forEach((qs, index) => {
        console.log(`    ${index + 1}. ID: ${qs.id}`);
        console.log(`       状態: ${qs.status}`);
        console.log(`       学生ID: ${qs.studentId}`);
        console.log(`       作成日: ${qs.createdAt}`);
      });
    } else {
      console.log('  ⚠️  QuestionScoreテーブルにレコードがありません');
    }
    
    console.log();

    // 2. User テーブルの状態確認
    console.log('👤 User テーブル統計:');
    const userCount = await prisma.user.count();
    console.log(`  総レコード数: ${userCount}`);
    
    if (userCount > 0) {
      const users = await prisma.user.findMany({
        take: 5,
        select: {
          id: true,
          username: true,
          name: true,
          role: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' }
      });
      
      console.log('  最新の5件:');
      users.forEach((user, index) => {
        console.log(`    ${index + 1}. ID: ${user.id}`);
        console.log(`       ユーザー名: ${user.username}`);
        console.log(`       名前: ${user.name}`);
        console.log(`       役割: ${user.role}`);
      });
    } else {
      console.log('  ⚠️  Userテーブルにレコードがありません');
    }
    
    console.log();

    // 3. DrawingAnnotation テーブルの状態確認
    console.log('🎨 DrawingAnnotation テーブル統計:');
    const annotationCount = await prisma.drawingAnnotation.count();
    console.log(`  総レコード数: ${annotationCount}`);
    
    if (annotationCount > 0) {
      const annotations = await prisma.drawingAnnotation.findMany({
        take: 5,
        select: {
          id: true,
          type: true,
          questionScoreId: true,
          createdByUserId: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' }
      });
      
      console.log('  最新の5件:');
      for (let i = 0; i < annotations.length; i++) {
        const annotation = annotations[i];
        console.log(`    ${i + 1}. ID: ${annotation.id}`);
        console.log(`       タイプ: ${annotation.type}`);
        console.log(`       QuestionScoreID: ${annotation.questionScoreId}`);
        console.log(`       作成者ID: ${annotation.createdByUserId}`);
        
        // 外部キーの存在確認
        if (annotation.questionScoreId) {
          const qsExists = await prisma.questionScore.findUnique({
            where: { id: annotation.questionScoreId },
            select: { id: true }
          });
          console.log(`       QuestionScore存在: ${qsExists ? '✅' : '❌'}`);
        }
        
        if (annotation.createdByUserId) {
          const userExists = await prisma.user.findUnique({
            where: { id: annotation.createdByUserId },
            select: { id: true }
          });
          console.log(`       User存在: ${userExists ? '✅' : '❌'}`);
        }
      }
    }
    
    console.log();

    // 4. 孤立したDrawingAnnotationの検索
    console.log('🔍 孤立したDrawingAnnotationの検索:');
    
    const orphanedAnnotations = await prisma.drawingAnnotation.findMany({
      where: {
        OR: [
          {
            questionScore: null
          },
          {
            AND: [
              { createdByUserId: { not: null } },
              { createdByUser: null }
            ]
          }
        ]
      },
      select: {
        id: true,
        type: true,
        questionScoreId: true,
        createdByUserId: true,
      }
    });
    
    if (orphanedAnnotations.length > 0) {
      console.log(`  ⚠️  孤立したアノテーションが${orphanedAnnotations.length}件見つかりました:`);
      orphanedAnnotations.forEach((annotation, index) => {
        console.log(`    ${index + 1}. ID: ${annotation.id}`);
        console.log(`       QuestionScoreID: ${annotation.questionScoreId}`);
        console.log(`       CreatedByUserID: ${annotation.createdByUserId}`);
      });
    } else {
      console.log('  ✅ 孤立したアノテーションは見つかりませんでした');
    }

    console.log();

    // 5. テスト用の外部キー値を提案
    console.log('💡 テスト用の有効な外部キー値:');
    
    const firstQuestionScore = await prisma.questionScore.findFirst({
      select: { id: true }
    });
    
    if (firstQuestionScore) {
      console.log(`  有効なQuestionScoreID: ${firstQuestionScore.id}`);
    } else {
      console.log('  ⚠️  有効なQuestionScoreIDがありません');
    }
    
    const firstUser = await prisma.user.findFirst({
      select: { id: true, username: true }
    });
    
    if (firstUser) {
      console.log(`  有効なUserID: ${firstUser.id} (${firstUser.username})`);
    } else {
      console.log('  ⚠️  有効なUserIDがありません');
    }

    console.log('\n✅ デバッグ完了');

  } catch (error) {
    console.error('💥 デバッグ実行エラー:', error);
    
    if (error.message.includes('database is locked')) {
      console.log('\n💡 対処法: アプリケーションを停止してから再実行してください');
    }
  } finally {
    await prisma.$disconnect();
  }
}

// スクリプト実行
if (require.main === module) {
  debugForeignKeyConstraints().catch(console.error);
}

module.exports = { debugForeignKeyConstraints };