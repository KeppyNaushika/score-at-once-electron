const { PrismaClient } = require('@prisma/client');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 安全なデータ移行スクリプト
async function safeDataMigration() {
  console.log('🔄 開始: 安全データ移行');
  
  const dbPath = path.join(__dirname, 'data', 'database.db');
  const db = new sqlite3.Database(dbPath);
  
  try {
    // 1. 現在のデータ数確認
    const checkData = () => new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          (SELECT COUNT(*) FROM LayoutRegion) as layoutRegions,
          (SELECT COUNT(*) FROM QuestionGroup) as questionGroups,
          (SELECT COUNT(*) FROM QuestionGroupItem) as questionGroupItems,
          (SELECT COUNT(*) FROM QuestionScore) as questionScores,
          (SELECT COUNT(*) FROM SubtotalDefinition) as subtotalDefinitions,
          (SELECT COUNT(*) FROM QuestionSubtotalAssignment) as questionSubtotalAssignments
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows[0]);
      });
    });
    
    const initialData = await checkData();
    console.log('📊 初期データ数:', initialData);
    
    // 2. テーブル存在確認
    const checkTables = () => new Promise((resolve, reject) => {
      db.all(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name IN ('CropRegion', 'SubtotalGroup', 'Subtotal', 'CropSubtotal')
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(r => r.name));
      });
    });
    
    const newTables = await checkTables();
    console.log('📋 新テーブル存在確認:', newTables);
    
    if (newTables.length === 0) {
      console.log('❌ 新しいテーブルが見つかりません。マイグレーションを先に実行してください。');
      return;
    }
    
    // 3. データ移行実行
    console.log('🚀 データ移行開始...');
    
    // LayoutRegion → CropRegion
    if (newTables.includes('CropRegion')) {
      await new Promise((resolve, reject) => {
        db.run(`
          INSERT OR IGNORE INTO CropRegion (
            id, projectId, masterImageId, label, type, 
            x, y, width, height, points, orderIndex, 
            createdAt, updatedAt
          )
          SELECT 
            id, projectId, masterImageId, label, type,
            x, y, width, height, points, orderIndex,
            createdAt, updatedAt
          FROM LayoutRegion
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      console.log('✅ LayoutRegion → CropRegion 移行完了');
    }
    
    // QuestionGroup → SubtotalGroup
    if (newTables.includes('SubtotalGroup')) {
      await new Promise((resolve, reject) => {
        db.run(`
          INSERT OR IGNORE INTO SubtotalGroup (
            id, name, projectId, description, createdAt, updatedAt
          )
          SELECT 
            id, name, projectId, NULL, createdAt, updatedAt
          FROM QuestionGroup
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      console.log('✅ QuestionGroup → SubtotalGroup 移行完了');
    }
    
    // QuestionGroupItem → Subtotal
    if (newTables.includes('Subtotal')) {
      await new Promise((resolve, reject) => {
        db.run(`
          INSERT OR IGNORE INTO Subtotal (
            id, name, subtotalGroupId, "order", createdAt, updatedAt
          )
          SELECT 
            id, name, questionGroupId, "order", createdAt, updatedAt
          FROM QuestionGroupItem
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      console.log('✅ QuestionGroupItem → Subtotal 移行完了');
    }
    
    // SubtotalDefinition → CropSubtotal
    if (newTables.includes('CropSubtotal')) {
      await new Promise((resolve, reject) => {
        db.run(`
          INSERT OR IGNORE INTO CropSubtotal (
            id, cropRegionId, subtotalId, assignmentType, createdAt, updatedAt
          )
          SELECT 
            id, layoutRegionId, questionGroupItemId, 'SUBTOTAL_DEFINITION', createdAt, updatedAt
          FROM SubtotalDefinition
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      // QuestionSubtotalAssignment → CropSubtotal
      await new Promise((resolve, reject) => {
        db.run(`
          INSERT OR IGNORE INTO CropSubtotal (
            id, cropRegionId, subtotalId, assignmentType, createdAt, updatedAt
          )
          SELECT 
            id, questionLayoutRegionId, questionGroupItemId, 'QUESTION_ASSIGNMENT', createdAt, updatedAt
          FROM QuestionSubtotalAssignment
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      console.log('✅ SubtotalDefinition + QuestionSubtotalAssignment → CropSubtotal 移行完了');
    }
    
    // QuestionScore のlayoutRegionId → cropRegionId 更新
    await new Promise((resolve, reject) => {
      db.run(`
        UPDATE QuestionScore 
        SET cropRegionId = layoutRegionId 
        WHERE cropRegionId IS NULL AND layoutRegionId IS NOT NULL
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('✅ QuestionScore cropRegionId 更新完了');
    
    // 4. 移行後データ確認
    const finalData = await checkData();
    console.log('📊 移行後データ数:', finalData);
    
    // 5. 新テーブルデータ確認
    const checkNewData = () => new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          (SELECT COUNT(*) FROM CropRegion) as cropRegions,
          (SELECT COUNT(*) FROM SubtotalGroup) as subtotalGroups,
          (SELECT COUNT(*) FROM Subtotal) as subtotals,
          (SELECT COUNT(*) FROM CropSubtotal) as cropSubtotals
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows[0]);
      });
    });
    
    const newData = await checkNewData();
    console.log('📊 新テーブルデータ数:', newData);
    
    console.log('🎉 データ移行完了!');
    
  } catch (error) {
    console.error('❌ データ移行エラー:', error);
  } finally {
    db.close();
  }
}

// メイン実行
if (require.main === module) {
  safeDataMigration();
}

module.exports = { safeDataMigration };