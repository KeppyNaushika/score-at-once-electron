const fs = require('fs');
const path = require('path');

/**
 * Electron-builder afterPack hook to restore and copy Prisma files
 * This restores Prisma files from temp location and copies them to the packaged app
 */
module.exports = async function(context) {
  const { appOutDir, packager } = context;
  const platform = packager.platform.name;
  
  console.log(`🔧 Restoring and copying Prisma files for ${platform}...`);
  
  try {
    const tempPath = path.join(process.cwd(), 'temp-prisma-backup');
    const nodeModulesPath = path.join(process.cwd(), 'node_modules');
    
    // First, restore Prisma files to original location
    console.log('🔄 Restoring Prisma files to node_modules...');
    
    const tempPrismaPath = path.join(tempPath, '@prisma');
    const prismaPath = path.join(nodeModulesPath, '@prisma');
    
    if (fs.existsSync(tempPrismaPath)) {
      await fs.promises.rename(tempPrismaPath, prismaPath);
    }
    
    const tempDotPrismaPath = path.join(tempPath, '.prisma');
    const dotPrismaPath = path.join(nodeModulesPath, '.prisma');
    
    if (fs.existsSync(tempDotPrismaPath)) {
      await fs.promises.rename(tempDotPrismaPath, dotPrismaPath);
    }
    
    // Clean up temp directory
    if (fs.existsSync(tempPath)) {
      await fs.promises.rmdir(tempPath, { recursive: true });
    }
    
    // Now copy Prisma files to the packaged app
    let targetDir;
    
    // Determine target directory based on platform
    if (platform === 'darwin') {
      targetDir = path.join(appOutDir, 'Electron.app', 'Contents', 'Resources', 'app', 'node_modules');
    } else if (platform === 'win32') {
      targetDir = path.join(appOutDir, 'resources', 'app', 'node_modules');
    } else {
      targetDir = path.join(appOutDir, 'resources', 'app', 'node_modules');
    }
    
    // Ensure target directory exists
    await fs.promises.mkdir(targetDir, { recursive: true });
    
    // Copy @prisma/client
    const prismaClientTarget = path.join(targetDir, '@prisma');
    
    if (fs.existsSync(prismaPath)) {
      console.log(`📦 Copying @prisma to packaged app...`);
      await copyRecursive(prismaPath, prismaClientTarget);
    }
    
    // Copy .prisma
    const dotPrismaTarget = path.join(targetDir, '.prisma');
    
    if (fs.existsSync(dotPrismaPath)) {
      console.log(`📦 Copying .prisma to packaged app...`);
      await copyRecursive(dotPrismaPath, dotPrismaTarget);
    }
    
    console.log(`✅ Prisma files restored and copied successfully for ${platform}`);
    
  } catch (error) {
    console.error(`❌ Error restoring/copying Prisma files: ${error.message}`);
    throw error;
  }
};

/**
 * Recursively copy directory contents
 */
async function copyRecursive(src, dest) {
  const stats = await fs.promises.stat(src);
  
  if (stats.isDirectory()) {
    await fs.promises.mkdir(dest, { recursive: true });
    const entries = await fs.promises.readdir(src);
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry);
      const destPath = path.join(dest, entry);
      await copyRecursive(srcPath, destPath);
    }
  } else {
    await fs.promises.copyFile(src, dest);
  }
}