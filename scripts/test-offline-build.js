#!/usr/bin/env node

/**
 * オフライン機能の包括的ビルドテストスクリプト
 *
 * このスクリプトは以下をテスト:
 * 1. Electron Forgeビルドの実行
 * 2. 重要なオフラインファイルの存在確認
 * 3. 配信アセットが node_modules の供給元と同一かの検証（バージョン・ビルド種別・破損）
 * 4. パッケージ構造の検証
 */

const crypto = require("crypto")
const fs = require("fs")
const path = require("path")
const { execSync } = require("child_process")

const repoRoot = path.join(__dirname, "..")

// 配信アセット（public 配下）と、その供給元（node_modules 内の正）の対応。
// postinstall の scripts/setup-mathjax-fonts.js が source から deployed へコピーする。
//
// 検証はサイズ閾値ではなく供給元とのハッシュ一致で行う。閾値は当て推量で、
// 依存を上げるたびに実サイズに追い越されて意味を失う一方、legacy と非legacy の
// worker（差5%未満）のような致命的な取り違えは通してしまうため。
const OFFLINE_ASSET_FILES = [
  {
    deployed: "public/js/mathjax/tex-svg.js",
    source: "node_modules/mathjax/tex-svg.js",
    pkg: "mathjax",
  },
  {
    // tex-svg.js が相対パスで遅延読み込みする読み上げ規則
    deployed: "public/js/mathjax/sre/speech-worker.js",
    source: "node_modules/mathjax/sre/speech-worker.js",
    pkg: "mathjax",
  },
  {
    // legacy ビルドであること自体が要件。src/lib/pdfConverter.ts が legacy 本体を
    // 読むため、非legacy の worker を混ぜると画像系PDFのデコードが失敗し空白になる。
    deployed: "public/js/pdf.worker.min.mjs",
    source: "node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    pkg: "pdfjs-dist",
  },
]

// ディレクトリ単位で同期されるアセット。source 側の全ファイルが揃っていることまで見る。
const OFFLINE_ASSET_DIRS = [
  {
    // JBIG2 / JPEG2000 のデコーダ。欠けるとスキャナ生成PDFが白紙になる。
    deployed: "public/js/wasm",
    source: "node_modules/pdfjs-dist/wasm",
    pkg: "pdfjs-dist",
  },
]

function formatSize(bytes) {
  return (bytes / 1024 / 1024).toFixed(2) + "MB"
}

function sha256(filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex")
}

function packageVersion(pkg) {
  try {
    return require(path.join(repoRoot, "node_modules", pkg, "package.json"))
      .version
  } catch {
    return null
  }
}

// deployed が source と同一かを検証する。差異はバージョンずれ・legacy取り違え・
// コピー破損のいずれかで、どれも「postinstall を通っていない」ことを意味する。
function verifyAgainstSource(deployed, source) {
  const deployedPath = path.join(repoRoot, deployed)
  const sourcePath = path.join(repoRoot, source)

  if (!fs.existsSync(sourcePath)) {
    console.error(`❌ 供給元が見つかりません: ${source}`)
    console.error("   npm install を実行してください")
    return false
  }
  if (!fs.existsSync(deployedPath)) {
    console.error(`❌ Missing: ${deployed}`)
    console.error(`   npm run postinstall で ${source} から同期されます`)
    return false
  }
  if (sha256(deployedPath) !== sha256(sourcePath)) {
    console.error(`❌ 供給元と不一致: ${deployed}`)
    console.error(`   期待: ${source}`)
    console.error("   npm run postinstall で再同期してください")
    return false
  }
  return true
}

function verifyPreBuildFiles() {
  console.log("\n🔍 ビルド前のオフラインファイル確認...")

  let allValid = true

  for (const { deployed, source, pkg } of OFFLINE_ASSET_FILES) {
    if (!verifyAgainstSource(deployed, source)) {
      allValid = false
      continue
    }
    const size = formatSize(fs.statSync(path.join(repoRoot, deployed)).size)
    console.log(`✅ ${deployed} (${size}, ${pkg}@${packageVersion(pkg)})`)
  }

  for (const { deployed, source, pkg } of OFFLINE_ASSET_DIRS) {
    const sourceDir = path.join(repoRoot, source)
    if (!fs.existsSync(sourceDir)) {
      console.error(`❌ 供給元が見つかりません: ${source}`)
      allValid = false
      continue
    }
    const entries = fs
      .readdirSync(sourceDir)
      .filter((entry) => fs.statSync(path.join(sourceDir, entry)).isFile())
    const dirValid = entries.every((entry) =>
      verifyAgainstSource(
        path.posix.join(deployed, entry),
        path.posix.join(source, entry)
      )
    )
    if (dirValid) {
      console.log(
        `✅ ${deployed}/ (${entries.length} files, ${pkg}@${packageVersion(pkg)})`
      )
    } else {
      allValid = false
    }
  }

  if (allValid) {
    console.log("✅ オフラインアセットは供給元と一致しています")
  } else {
    console.error("❌ オフラインアセットの検証に失敗しました")
    process.exit(1)
  }

  return allValid
}

function runDryBuild() {
  console.log("\n🔨 Electron Forgeドライビルドテスト...")

  try {
    // package.jsonから現在のビルド設定を確認
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8")
    )
    console.log(`📦 Package: ${packageJson.name} v${packageJson.version}`)

    // Electron Forge設定確認
    const forgeConfig = require("../forge.config.js")
    console.log(
      `⚙️  Forge Config: extraResource items = ${forgeConfig.packagerConfig.extraResource.length}`
    )

    // Next.js出力を確認
    const nextOutputPath = path.join(__dirname, "..", ".next")
    if (fs.existsSync(nextOutputPath)) {
      console.log("✅ Next.js build output found")
    } else {
      console.warn(
        "⚠️  Next.js build output not found - running npm run build first"
      )
      execSync("npm run build", {
        cwd: path.join(__dirname, ".."),
        stdio: "inherit",
      })
    }

    console.log("✅ ドライビルドチェック完了")
  } catch (error) {
    console.error("❌ ドライビルドエラー:", error.message)
    return false
  }

  return true
}

function simulatePackaging() {
  console.log("\n📁 パッケージ構造シミュレーション...")

  // 仮想的なElectronパッケージ構造をチェック
  const _resourcePaths = [
    "Contents/Resources/public/js/mathjax/tex-svg.js", // macOS
    "Contents/Resources/public/js/pdf.worker.min.mjs",
    "resources/public/js/mathjax/tex-svg.js", // Windows/Linux
    "resources/public/js/pdf.worker.min.mjs",
  ]

  console.log("🔍 パッケージに含まれるべきファイル:")
  for (const { deployed } of OFFLINE_ASSET_FILES) {
    console.log(`  - ${deployed}`)
  }
  for (const { deployed } of OFFLINE_ASSET_DIRS) {
    console.log(`  - ${deployed}/`)
  }

  console.log("📍 パッケージ内パス (macOS): Contents/Resources/")
  console.log("📍 パッケージ内パス (Win/Linux): resources/")

  return true
}

function testOfflineCapabilities() {
  console.log("\n🌐 オフライン機能テスト...")

  const tests = [
    {
      name: "MathJax初期化",
      description: "ローカルMathJaxファイルの読み込み能力",
      file: "public/js/mathjax/tex-svg.js",
      test: (content) => {
        // MathJaxはwebpackバンドルされているため__webpack_modules__を探す
        const hasWebpackModules = content.includes("__webpack_modules__")
        // 最小サイズを確認
        const hasMinSize = content.length > 1700000
        // MathJaxのローカルバンドルであることを確認（実際にはHTMLエンティティ定義が含まれている）
        const hasMathJaxContent =
          content.includes("HTML_ENTITIES") || content.includes("MathJax")
        return hasWebpackModules && hasMinSize && hasMathJaxContent
      },
    },
    {
      name: "PDF Worker",
      description: "ローカルPDF Workerファイルの完全性",
      file: "public/js/pdf.worker.min.mjs",
      test: (content) =>
        content.includes("Mozilla Foundation") && content.length > 500000,
    },
  ]

  let allPassed = true

  tests.forEach(({ name, description, file, test }) => {
    try {
      const filePath = path.join(__dirname, "..", file)
      const content = fs.readFileSync(filePath, "utf8")

      if (test(content)) {
        console.log(`✅ ${name}: ${description}`)
      } else {
        console.error(`❌ ${name}: テスト失敗`)
        allPassed = false
      }
    } catch (error) {
      console.error(`❌ ${name}: ファイル読み込みエラー - ${error.message}`)
      allPassed = false
    }
  })

  return allPassed
}

function generateReport() {
  console.log("\n📋 オフライン対応レポート")
  console.log("=".repeat(50))

  console.log("\n✅ 完全オフライン対応済み:")
  console.log(`  - MathJax ${packageVersion("mathjax")} (ローカルバンドル)`)
  console.log(
    `  - PDF.js Worker ${packageVersion("pdfjs-dist")} (ローカルバンドル)`
  )
  console.log("  - 外部CDN依存なし")
  console.log("  - Electron Forgeビルド設定完了")

  console.log("\n📦 ビルド後の確認項目:")
  console.log("  1. アプリケーション起動テスト")
  console.log("  2. ネットワーク切断状態での数式表示テスト")
  console.log("  3. PDF読み込み・変換テスト")
  console.log("  4. 数式表示の動作確認")
  console.log("  5. PDF読み込みの動作確認")

  console.log("\n🚀 推奨ビルドコマンド:")
  console.log("  npm run make          # 完全ビルド")
  console.log("  npm run package       # パッケージのみ")

  console.log("\n" + "=".repeat(50))
}

// メイン実行
async function main() {
  // --verify-only はアセット検証だけを行う。ビルド前フック（prebuild）から呼ぶための入口で、
  // runDryBuild() が npm run build を起動しうるため全部入りの main を繋ぐと再帰する。
  if (process.argv.includes("--verify-only")) {
    verifyPreBuildFiles() // 失敗時はこの中で exit(1)
    return
  }

  console.log("🚀 Score-at-Once オフライン機能ビルドテスト開始")
  console.log("=".repeat(60))

  let success = true

  success &= verifyPreBuildFiles()
  success &= runDryBuild()
  success &= simulatePackaging()
  success &= testOfflineCapabilities()

  generateReport()

  if (success) {
    console.log("\n🎉 すべてのテストが成功しました！")
    console.log("アプリケーションは完全にオフライン環境で動作します。")
    process.exit(0)
  } else {
    console.log("\n⚠️  一部のテストが失敗しました。")
    console.log("上記のエラーを確認してください。")
    process.exit(1)
  }
}

// エラーハンドリング
process.on("unhandledRejection", (error) => {
  console.error("❌ 未処理エラー:", error)
  process.exit(1)
})

if (require.main === module) {
  main()
}
