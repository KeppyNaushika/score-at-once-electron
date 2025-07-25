const { execSync } = require('child_process');
const { createRelease } = require('./release');

async function createPrerelease(prereleaseType) {
  try {
    console.log(`🚀 Creating pre-release (${prereleaseType})...`);
    
    // Bump version with prerelease
    execSync(`npm version pre${prereleaseType}`, { stdio: 'inherit' });
    
    // Get new version
    const packageJson = require('../package.json');
    const newVersion = packageJson.version;
    
    console.log(`✅ Version bumped to: ${newVersion}`);
    console.log('📤 Pushing version commit and tag...');
    
    // Push the version commit and tag created by npm version
    execSync('git push', { stdio: 'inherit' });
    execSync('git push --tags', { stdio: 'inherit' });
    
    // Create pre-release
    await createPrereleaseGitHub(newVersion);
    
  } catch (error) {
    console.error('❌ Pre-release failed:', error.message);
    process.exit(1);
  }
}

async function createPrereleaseGitHub(version) {
  try {
    console.log('🚀 Starting pre-release process...\n');

    // Check if gh CLI is installed
    try {
      execSync('gh --version', { stdio: 'ignore' });
    } catch (error) {
      console.error('❌ GitHub CLI (gh) is not installed.');
      console.log('Please install it: https://cli.github.com/');
      process.exit(1);
    }

    // Check if user is authenticated
    try {
      execSync('gh auth status', { stdio: 'ignore' });
    } catch (error) {
      console.error('❌ Not authenticated with GitHub.');
      console.log('Please run: gh auth login');
      process.exit(1);
    }

    console.log(`📦 Creating pre-release for version: ${version}`);

    // Clean and build
    console.log('🧹 Cleaning previous builds...');
    execSync('npm run clean', { stdio: 'inherit' });

    console.log('🔍 Running pre-build checks...');
    execSync('npm run check-all', { stdio: 'inherit' });

    console.log('🏗️  Building application...');
    execSync('npm run build', { stdio: 'inherit' });

    console.log('📦 Creating distribution packages...');
    execSync('npm run dist', { stdio: 'inherit' });

    // Create release archives
    console.log('📦 Creating pre-release archives...');
    
    const fs = require('fs');
    const path = require('path');
    
    const distPath = path.join(process.cwd(), 'dist');
    const releasesPath = path.join(process.cwd(), 'releases');
    
    // Create releases directory
    if (!fs.existsSync(releasesPath)) {
      fs.mkdirSync(releasesPath);
    }

    const archives = [];

    // Check what platforms were built
    const distContents = fs.readdirSync(distPath);
    
    // macOS
    if (distContents.some(item => item.includes('mac'))) {
      const macDir = distContents.find(item => item.includes('mac'));
      const macArchive = `releases/一括採点-${version}-mac.zip`;
      console.log(`  📱 Creating macOS archive: ${macArchive}`);
      execSync(`cd dist && zip -r ../${macArchive} "${macDir}"`, { stdio: 'inherit' });
      archives.push(macArchive);
    }

    // Windows
    if (distContents.some(item => item.includes('win'))) {
      const winDir = distContents.find(item => item.includes('win'));
      const winArchive = `releases/一括採点-${version}-windows.zip`;
      console.log(`  🪟 Creating Windows archive: ${winArchive}`);
      execSync(`cd dist && zip -r ../${winArchive} "${winDir}"`, { stdio: 'inherit' });
      archives.push(winArchive);
    }

    // Linux
    if (distContents.some(item => item.includes('linux'))) {
      const linuxDir = distContents.find(item => item.includes('linux'));
      const linuxArchive = `releases/一括採点-${version}-linux.zip`;
      console.log(`  🐧 Creating Linux archive: ${linuxArchive}`);
      execSync(`cd dist && zip -r ../${linuxArchive} "${linuxDir}"`, { stdio: 'inherit' });
      archives.push(linuxArchive);
    }

    if (archives.length === 0) {
      console.error('❌ No distribution files found to archive');
      process.exit(1);
    }

    // Generate pre-release notes
    const releaseNotes = generatePrereleaseNotes(version);

    // Create GitHub pre-release
    console.log('🎉 Creating GitHub pre-release...');
    
    const tagName = `v${version}`;
    const releaseCommand = [
      'gh', 'release', 'create', tagName,
      ...archives,
      '--prerelease',  // This marks it as pre-release
      '--title', `一括採点 ${tagName} (Pre-release)`,
      '--notes', releaseNotes
    ];

    execSync(releaseCommand.join(' '), { stdio: 'inherit' });

    console.log('\n✅ Pre-release created successfully!');
    console.log(`🔗 View pre-release: https://github.com/$(gh repo view --json owner,name -q '.owner.login + "/" + .name')/releases/tag/${tagName}`);
    
    // Cleanup
    console.log('🧹 Cleaning up temporary files...');
    fs.rmSync(releasesPath, { recursive: true, force: true });

  } catch (error) {
    console.error('❌ Pre-release failed:', error.message);
    process.exit(1);
  }
}

function generatePrereleaseNotes(version) {
  const fs = require('fs');
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  const prereleaseType = version.includes('alpha') ? 'Alpha' : 
                        version.includes('beta') ? 'Beta' : 
                        version.includes('rc') ? 'Release Candidate' : 'Pre-release';
  
  return `## 一括採点 ${version} (${prereleaseType})

⚠️ **これはプレリリース版です** - テスト用途での使用を推奨します

### 📦 ダウンロード

- **macOS**: \`一括採点-${version}-mac.zip\`
- **Windows**: \`一括採点-${version}-windows.zip\`
- **Linux**: \`一括採点-${version}-linux.zip\`

### 🧪 プレリリース版について

この版は開発中の機能を含んでおり、予期しない動作をする可能性があります。
本番環境での使用は避け、テストやフィードバック目的でご利用ください。

### ⚠️ 重要な使用制限

- **開発段階のプレビュー版** - 動作保証なし、データ損失の可能性があります
- **テスト不十分** - 重要なデータのバックアップを推奨します
- **再配布禁止** - 第三者への提供・転載を禁止します
- **30日間の使用期限** - 配信日から30日後にソフトウェアを削除してください
- **使用停止要請** - 著作権者からの要請時は直ちに使用を中止してください

### 🚀 機能

${packageJson.description || '複数教員による協調採点システム'}

### 📝 使用方法

1. お使いのOSに対応するZIPファイルをダウンロード
2. 解凍してフォルダ内の実行ファイルを起動
   - macOS: \`一括採点.app\`
   - Windows: \`一括採点.exe\`
   - Linux: \`一括採点\`

### 🐛 フィードバック

問題や改善点がございましたら、Issue または Discussion でお知らせください。

---

**作者**: ${packageJson.author}
**バージョン**: ${version}
**種類**: ${prereleaseType}`;
}

// Export function for use in other scripts
module.exports = { createPrerelease, createPrereleaseGitHub };

// Only run if this file is executed directly
if (require.main === module) {
  // Get prerelease type from command line argument
  const prereleaseType = process.argv[2] || 'patch';

  if (!['patch', 'minor', 'major'].includes(prereleaseType)) {
    console.error('❌ Invalid prerelease type. Use: patch, minor, or major');
    process.exit(1);
  }

  createPrerelease(prereleaseType);
}