const fs = require('fs');
const path = require('path');

/**
 * Electron-builder beforePack hook to temporarily move Prisma files
 * This prevents electron-builder from copying them and causing EEXIST errors
 */
module.exports = async function(context) {
  console.log('🔧 Preparing Prisma files for safe packaging...');
  
  try {
    const nodeModulesPath = path.join(process.cwd(), 'node_modules');
    const tempPath = path.join(process.cwd(), 'temp-prisma-backup');
    
    // Create temporary backup directory
    await fs.promises.mkdir(tempPath, { recursive: true });
    
    // Move @prisma directory to temp location
    const prismaPath = path.join(nodeModulesPath, '@prisma');
    const tempPrismaPath = path.join(tempPath, '@prisma');
    
    if (fs.existsSync(prismaPath)) {
      console.log('📦 Moving @prisma to temporary location...');
      await fs.promises.rename(prismaPath, tempPrismaPath);
    }
    
    // Move .prisma directory to temp location
    const dotPrismaPath = path.join(nodeModulesPath, '.prisma');
    const tempDotPrismaPath = path.join(tempPath, '.prisma');
    
    if (fs.existsSync(dotPrismaPath)) {
      console.log('📦 Moving .prisma to temporary location...');
      await fs.promises.rename(dotPrismaPath, tempDotPrismaPath);
    }
    
    console.log('✅ Prisma files temporarily moved');
    
  } catch (error) {
    console.error(`❌ Error preparing Prisma files: ${error.message}`);
    throw error;
  }
};