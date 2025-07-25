const { execSync } = require('child_process');
const { createRelease } = require('./release');

async function versionAndRelease(versionType) {
  try {
    console.log(`🔄 Bumping version (${versionType})...`);
    
    // Bump version
    execSync(`npm version ${versionType}`, { stdio: 'inherit' });
    
    // Get new version
    const packageJson = require('../package.json');
    const newVersion = packageJson.version;
    
    console.log(`✅ Version bumped to: ${newVersion}`);
    console.log('📤 Pushing version commit and tag...');
    
    // Push the version commit and tag created by npm version
    execSync('git push', { stdio: 'inherit' });
    execSync('git push --tags', { stdio: 'inherit' });
    
    // Create release
    await createRelease();
    
  } catch (error) {
    console.error('❌ Version and release failed:', error.message);
    process.exit(1);
  }
}

// Get version type from command line argument
const versionType = process.argv[2] || 'patch';

if (!['patch', 'minor', 'major'].includes(versionType)) {
  console.error('❌ Invalid version type. Use: patch, minor, or major');
  process.exit(1);
}

versionAndRelease(versionType);