const { execSync } = require("child_process")
const fs = require("fs")
const path = require("path")
const { notifyRelease } = require("./discord-notify").default
require("dotenv").config()

async function createRelease() {
  try {
    console.log("🚀 Starting automated release process...\n")

    // Check if gh CLI is installed
    try {
      execSync("gh --version", { stdio: "ignore" })
    } catch {
      console.error("❌ GitHub CLI (gh) is not installed.")
      console.log("Please install it: https://cli.github.com/")
      process.exit(1)
    }

    // Check if user is authenticated
    try {
      execSync("gh auth status", { stdio: "ignore" })
    } catch {
      console.error("❌ Not authenticated with GitHub.")
      console.log("Please run: gh auth login")
      process.exit(1)
    }

    // Get current version from package.json
    const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"))
    const currentVersion = packageJson.version

    console.log(`📦 Current version: ${currentVersion}`)

    // Clean and build
    console.log("🧹 Cleaning previous builds...")
    execSync("npm run clean", { stdio: "inherit" })

    console.log("🔍 Running pre-build checks...")
    execSync("npm run check-all", { stdio: "inherit" })

    console.log("🏗️  Building application...")
    execSync("npm run build", { stdio: "inherit" })

    console.log("📦 Creating distribution packages...")
    execSync("npm run dist", { stdio: "inherit" })

    // Create release archives
    console.log("📦 Creating release archives...")

    const distPath = path.join(process.cwd(), "dist")
    const releasesPath = path.join(process.cwd(), "releases")

    // Create releases directory
    if (!fs.existsSync(releasesPath)) {
      fs.mkdirSync(releasesPath)
    }

    const archives = []

    // Check what platforms were built
    const distContents = fs.readdirSync(distPath)

    // macOS
    if (distContents.some((item) => item.includes("mac"))) {
      const macDir = distContents.find((item) => item.includes("mac"))
      const macArchive = `releases/一括採点-${currentVersion}-mac.zip`
      console.log(`  📱 Creating macOS archive: ${macArchive}`)
      execSync(`cd dist && zip -r ../${macArchive} "${macDir}"`, {
        stdio: "inherit",
      })
      archives.push(macArchive)
    }

    // Note: Only macOS builds are created to avoid cross-compilation issues
    // Windows and Linux builds would require native compilation on respective platforms

    if (archives.length === 0) {
      console.error("❌ No distribution files found to archive")
      process.exit(1)
    }

    // Create git tag
    const tagName = `v${currentVersion}`
    console.log(`🏷️  Creating git tag: ${tagName}`)

    try {
      execSync(`git tag -a ${tagName} -m "Release ${tagName}"`, {
        stdio: "inherit",
      })
      execSync(`git push origin ${tagName}`, { stdio: "inherit" })
    } catch {
      console.log(`⚠️  Tag ${tagName} may already exist, continuing...`)
    }

    // Generate release notes
    const releaseNotes = generateReleaseNotes(currentVersion)

    // Create GitHub release
    console.log("🎉 Creating GitHub release...")

    // リリースノートをファイルに書き出し
    const tempNotesFile = `temp-notes-${currentVersion}.md`
    fs.writeFileSync(tempNotesFile, releaseNotes)

    try {
      // 個別にコマンドを構築してクォート問題を回避
      const titleText = `一括採点 ${tagName}`

      execSync(
        [
          "gh",
          "release",
          "create",
          tagName,
          ...archives,
          "--title",
          `"${titleText}"`,
          "--notes-file",
          tempNotesFile,
        ].join(" "),
        { stdio: "inherit" }
      )
    } finally {
      // 一時ファイルを削除
      if (fs.existsSync(tempNotesFile)) {
        fs.unlinkSync(tempNotesFile)
      }
    }

    console.log("\n✅ Release created successfully!")

    // リリースURLを取得
    const repoInfo = JSON.parse(
      execSync("gh repo view --json owner,name", { encoding: "utf-8" })
    )
    const releaseUrl = `https://github.com/${repoInfo.owner.login}/${repoInfo.name}/releases/tag/${tagName}`

    console.log(`🔗 View release: ${releaseUrl}`)

    // Discord通知を送信
    await notifyRelease(currentVersion, releaseUrl, false)

    // Cleanup
    console.log("🧹 Cleaning up temporary files...")
    fs.rmSync(releasesPath, { recursive: true, force: true })
  } catch (error) {
    console.error("❌ Release failed:", error.message)
    process.exit(1)
  }
}

function generateReleaseNotes(version) {
  const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"))

  return `## 一括採点 ${version}

本リリースは **GNU Affero General Public License v3.0（AGPLv3）** の下で公開されています。ネットワーク経由で提供する場合も、利用者が対応するソースコードへアクセスできるようにしてください。

### 📦 ダウンロード

- **macOS**: \`一括採点-${version}-mac.zip\`
- **Windows**: \`一括採点-${version}-windows.zip\`
- **Linux**: \`一括採点-${version}-linux.zip\`

### 🚀 機能

${packageJson.description || "複数教員による協調採点システム"}

### 📝 使用方法

1. お使いのOSに対応するZIPファイルをダウンロード
2. 解凍してフォルダ内の実行ファイルを起動
   - macOS: \`一括採点.app\`
   - Windows: \`一括採点.exe\`
   - Linux: \`一括採点\`

### 🐛 フィードバック

不具合報告や改善提案をお待ちしています。Issue や Discussion でお気軽にご連絡ください。

### 📄 ライセンス

- 本ソフトウェアは AGPLv3 に従ってご利用ください。
- 再配布・派生物提供時は同一ライセンスを適用し、ライセンスと著作権表示を保持してください。
- サーバーやクラウドで提供する場合も、改変ソースコード一式を利用者に開示する必要があります。

詳細は \`LICENSE\` を参照してください。

---

**作者**: ${packageJson.author}
**バージョン**: ${version}`
}

if (require.main === module) {
  createRelease()
}

module.exports = { createRelease }
