const fs = require('fs');
const path = require('path');

/**
 * Electron-builder afterPack hook to copy Prisma files
 * This avoids EEXIST conflicts by copying Prisma files after the main packaging
 */
module.exports = async function(context) {
  const { appOutDir, packager } = context;
  const platform = packager.platform.name;
  
  console.log(`🔧 Copying Prisma files for ${platform}...`);
  
  try {
    const sourceDir = path.join(process.cwd(), 'node_modules');
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
    const prismaClientSource = path.join(sourceDir, '@prisma');
    const prismaClientTarget = path.join(targetDir, '@prisma');
    
    if (fs.existsSync(prismaClientSource)) {
      console.log(`📦 Copying @prisma/client...`);
      await copyRecursive(prismaClientSource, prismaClientTarget);
    }
    
    // Copy .prisma
    const dotPrismaSource = path.join(sourceDir, '.prisma');
    const dotPrismaTarget = path.join(targetDir, '.prisma');
    
    if (fs.existsSync(dotPrismaSource)) {
      console.log(`📦 Copying .prisma...`);
      await copyRecursive(dotPrismaSource, dotPrismaTarget);
    }
    
    console.log(`✅ Prisma files copied successfully for ${platform}`);
    
  } catch (error) {
    console.error(`❌ Error copying Prisma files: ${error.message}`);
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