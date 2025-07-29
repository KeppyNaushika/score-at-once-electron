const { PrismaClient } = require('@prisma/client');

async function prismaDataMigration() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔄 開始: Prisma経由データ移行');
    
    // 1. 現在のデータ確認
    const layoutRegions = await prisma.$queryRaw`SELECT COUNT(*) as count FROM LayoutRegion`;
    const questionGroups = await prisma.$queryRaw`SELECT COUNT(*) as count FROM QuestionGroup`;
    const questionScores = await prisma.$queryRaw`SELECT COUNT(*) as count FROM QuestionScore`;
    
    console.log('📊 移行前データ数:');
    console.log('  LayoutRegion:', layoutRegions[0].count);
    console.log('  QuestionGroup:', questionGroups[0].count);
    console.log('  QuestionScore:', questionScores[0].count);
    
    // 2. 新しいテーブルが存在するか確認
    try {
      const cropRegions = await prisma.$queryRaw`SELECT COUNT(*) as count FROM CropRegion`;
      console.log('  CropRegion:', cropRegions[0].count);
    } catch (error) {
      console.log('❌ 新しいテーブルが見つかりません');
      return;
    }
    
    // 3. LayoutRegion → CropRegion データ移行
    console.log('🚀 LayoutRegion → CropRegion 移行開始...');
    await prisma.$executeRaw`
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
    `;
    console.log('✅ LayoutRegion → CropRegion 移行完了');
    
    // 4. QuestionGroup → SubtotalGroup データ移行
    console.log('🚀 QuestionGroup → SubtotalGroup 移行開始...');
    await prisma.$executeRaw`
      INSERT OR IGNORE INTO SubtotalGroup (
        id, name, projectId, description, createdAt, updatedAt
      )
      SELECT 
        id, name, projectId, NULL, createdAt, updatedAt
      FROM QuestionGroup
    `;
    console.log('✅ QuestionGroup → SubtotalGroup 移行完了');
    
    // 5. QuestionGroupItem → Subtotal データ移行
    console.log('🚀 QuestionGroupItem → Subtotal 移行開始...');
    await prisma.$executeRaw`
      INSERT OR IGNORE INTO Subtotal (
        id, name, subtotalGroupId, "order", createdAt, updatedAt
      )
      SELECT 
        id, name, questionGroupId, "order", createdAt, updatedAt
      FROM QuestionGroupItem
    `;
    console.log('✅ QuestionGroupItem → Subtotal 移行完了');
    
    // 6. SubtotalDefinition → CropSubtotal データ移行
    console.log('🚀 SubtotalDefinition → CropSubtotal 移行開始...');
    await prisma.$executeRaw`
      INSERT OR IGNORE INTO CropSubtotal (
        id, cropRegionId, subtotalId, assignmentType, createdAt, updatedAt
      )
      SELECT 
        id, layoutRegionId, questionGroupItemId, 'SUBTOTAL_DEFINITION', createdAt, updatedAt
      FROM SubtotalDefinition
    `;
    
    // 7. QuestionSubtotalAssignment → CropSubtotal データ移行
    await prisma.$executeRaw`
      INSERT OR IGNORE INTO CropSubtotal (
        id, cropRegionId, subtotalId, assignmentType, createdAt, updatedAt
      )
      SELECT 
        id, questionLayoutRegionId, questionGroupItemId, 'QUESTION_ASSIGNMENT', createdAt, updatedAt
      FROM QuestionSubtotalAssignment
    `;
    console.log('✅ SubtotalDefinition + QuestionSubtotalAssignment → CropSubtotal 移行完了');
    
    // 8. QuestionScore のlayoutRegionId → cropRegionId 更新
    console.log('🚀 QuestionScore cropRegionId 更新開始...');
    await prisma.$executeRaw`
      UPDATE QuestionScore 
      SET cropRegionId = layoutRegionId 
      WHERE cropRegionId IS NULL AND layoutRegionId IS NOT NULL
    `;
    console.log('✅ QuestionScore cropRegionId 更新完了');
    
    // 9. UserProject に既存のProject-Userの関係を移行
    console.log('🚀 Project-User → UserProject 移行開始...');
    await prisma.$executeRaw`
      INSERT OR IGNORE INTO UserProject (
        id, userId, projectId, role, joinedAt, createdAt, updatedAt
      )
      SELECT 
        lower(hex(randomblob(16))), 
        userId, 
        id, 
        'OWNER', 
        createdAt, 
        createdAt, 
        updatedAt
      FROM Project
    `;
    console.log('✅ Project-User → UserProject 移行完了');
    
    // 10. ProjectSubtotalGroup に既存の関係を移行
    console.log('🚀 Project-SubtotalGroup → ProjectSubtotalGroup 移行開始...');
    await prisma.$executeRaw`
      INSERT OR IGNORE INTO ProjectSubtotalGroup (
        id, projectId, subtotalGroupId, "order", isActive, createdAt, updatedAt
      )
      SELECT 
        lower(hex(randomblob(16))), 
        projectId, 
        id, 
        0, 
        1, 
        createdAt, 
        updatedAt
      FROM SubtotalGroup
      WHERE projectId IS NOT NULL
    `;
    console.log('✅ Project-SubtotalGroup → ProjectSubtotalGroup 移行完了');
    
    // 11. 移行後データ確認
    const finalCropRegions = await prisma.$queryRaw`SELECT COUNT(*) as count FROM CropRegion`;
    const finalSubtotalGroups = await prisma.$queryRaw`SELECT COUNT(*) as count FROM SubtotalGroup`;
    const finalSubtotals = await prisma.$queryRaw`SELECT COUNT(*) as count FROM Subtotal`;
    const finalCropSubtotals = await prisma.$queryRaw`SELECT COUNT(*) as count FROM CropSubtotal`;
    const finalUserProjects = await prisma.$queryRaw`SELECT COUNT(*) as count FROM UserProject`;
    const finalProjectSubtotalGroups = await prisma.$queryRaw`SELECT COUNT(*) as count FROM ProjectSubtotalGroup`;
    
    console.log('📊 移行後データ数:');
    console.log('  CropRegion:', finalCropRegions[0].count);
    console.log('  SubtotalGroup:', finalSubtotalGroups[0].count);
    console.log('  Subtotal:', finalSubtotals[0].count);
    console.log('  CropSubtotal:', finalCropSubtotals[0].count);
    console.log('  UserProject:', finalUserProjects[0].count);
    console.log('  ProjectSubtotalGroup:', finalProjectSubtotalGroups[0].count);
    
    console.log('🎉 データ移行完了!');
    
  } catch (error) {
    console.error('❌ データ移行エラー:', error);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  prismaDataMigration();
}

module.exports = { prismaDataMigration };