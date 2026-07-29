#!/usr/bin/env node

/**
 * フォント・アセットセットアップスクリプト
 * Electron/OFFLINEビルドでリソース欠損を防ぐ
 *
 * コピーされるアセット:
 * - MathJax バンドル（数式表示用。tex-svg.js と SRE）
 * - PDF.js Worker（PDF変換用）
 * - PDF.js WASM デコーダ
 * - Noto Sans JP フォント（個人成績表PDF用）
 */

const fs = require("fs")
const path = require("path")

const repoRoot = path.resolve(__dirname, "..")

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

const copyRecursive = (src, dest) => {
  const stats = fs.statSync(src)
  if (stats.isDirectory()) {
    ensureDir(dest)
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry))
    }
  } else {
    fs.copyFileSync(src, dest)
  }
}

// MathJax バンドルのセットアップ
// layout.tsx が /js/mathjax/tex-svg.js を読み込むため public へ配置する。
//
// NOTE: MathJax 4 では woff フォントが本体から @mathjax/*-font パッケージへ分離された。
// ただしこのアプリは SVG 出力（tex-svg.js）を使っており、SVG はグリフをパスで描くため
// Web フォントを一切必要としない。v3 時代の output/chtml/fonts/woff-v2 のコピーは
// 不要になったので廃止した。
const mathJaxSourceDir = path.join(repoRoot, "node_modules", "mathjax")
const mathJaxTargetDir = path.join(repoRoot, "public", "js", "mathjax")

// tex-svg.js は数式本体、sre は読み上げ規則（tex-svg.js が相対パスで遅延読み込みする）
const MATHJAX_ASSETS = ["tex-svg.js", "sre"]

if (!fs.existsSync(mathJaxSourceDir)) {
  console.error("MathJaxパッケージが見つかりません: " + mathJaxSourceDir)
  process.exit(1)
}

ensureDir(mathJaxTargetDir)
for (const asset of MATHJAX_ASSETS) {
  const src = path.join(mathJaxSourceDir, asset)
  if (!fs.existsSync(src)) {
    console.error(
      `MathJaxアセットが見つかりません: ${path.join("node_modules", "mathjax", asset)}`
    )
    process.exit(1)
  }
  copyRecursive(src, path.join(mathJaxTargetDir, asset))
}

const mathJaxVersion = require(
  path.join(mathJaxSourceDir, "package.json")
).version
console.log(
  `✓ MathJax ${mathJaxVersion} bundle copied (${MATHJAX_ASSETS.join(", ")})`
)
console.log(`  to ${mathJaxTargetDir}`)

// PDF.js workerファイルのセットアップ
// NOTE: src/lib/pdfConverter.ts は legacy ビルド (pdfjs-dist/legacy/build/pdf.min.mjs)
// を読み込むため、worker も必ず legacy ビルドを使うこと。
// 非legacy (build/) を混在させると画像系PDFのデコードが失敗し空白描画になる。
const pdfWorkerSource = path.join(
  repoRoot,
  "node_modules",
  "pdfjs-dist",
  "legacy",
  "build",
  "pdf.worker.min.mjs"
)
const pdfWorkerDest = path.join(repoRoot, "public", "js", "pdf.worker.min.mjs")

if (!fs.existsSync(pdfWorkerSource)) {
  console.error("PDF.js workerファイルが見つかりません: " + pdfWorkerSource)
  process.exit(1)
}

const pdfWorkerDestDir = path.dirname(pdfWorkerDest)
ensureDir(pdfWorkerDestDir)
fs.copyFileSync(pdfWorkerSource, pdfWorkerDest)

console.log(`✓ PDF.js worker file copied from ${pdfWorkerSource}`)
console.log(`  to ${pdfWorkerDest}`)

// PDF.js WASM デコーダのセットアップ
// PDF.js 6.x は JBIG2 / JPEG2000 画像のデコードに WASM を使う。これが配信されていないと
// スキャナ生成PDF（JBIG2/CCITT等）が白紙になる。pdfConverter.ts の wasmUrl="/js/wasm/" が
// 参照するため、public/js/wasm/ に配置する。
const pdfWasmSourceDir = path.join(
  repoRoot,
  "node_modules",
  "pdfjs-dist",
  "wasm"
)
const pdfWasmDestDir = path.join(repoRoot, "public", "js", "wasm")

if (!fs.existsSync(pdfWasmSourceDir)) {
  console.error("PDF.js WASMディレクトリが見つかりません: " + pdfWasmSourceDir)
  process.exit(1)
}

ensureDir(pdfWasmDestDir)
let wasmCount = 0
for (const entry of fs.readdirSync(pdfWasmSourceDir)) {
  const src = path.join(pdfWasmSourceDir, entry)
  if (fs.statSync(src).isFile()) {
    fs.copyFileSync(src, path.join(pdfWasmDestDir, entry))
    wasmCount++
  }
}
console.log(`✓ PDF.js WASM files copied (${wasmCount}) to ${pdfWasmDestDir}`)

// Noto Sans JP フォントのセットアップ（個人成績表PDF用）
const notoSansJpFontsDir = path.join(
  repoRoot,
  "node_modules",
  "@fontsource",
  "noto-sans-jp",
  "files"
)
const notoSansJpTargetDir = path.join(repoRoot, "public", "fonts")

// コピー対象のフォントファイル（japanese subset の 400/700 weight）
const notoSansJpFonts = [
  "noto-sans-jp-japanese-400-normal.woff",
  "noto-sans-jp-japanese-700-normal.woff",
]

if (!fs.existsSync(notoSansJpFontsDir)) {
  console.warn("⚠ Noto Sans JP フォントが見つかりません: " + notoSansJpFontsDir)
  console.warn("  npm install @fontsource/noto-sans-jp を実行してください")
} else {
  ensureDir(notoSansJpTargetDir)
  let copiedCount = 0
  for (const fontFile of notoSansJpFonts) {
    const src = path.join(notoSansJpFontsDir, fontFile)
    const dest = path.join(notoSansJpTargetDir, fontFile)
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest)
      copiedCount++
    } else {
      console.warn(`⚠ フォントファイルが見つかりません: ${fontFile}`)
    }
  }
  console.log(
    `✓ Noto Sans JP fonts copied (${copiedCount}/${notoSansJpFonts.length} files)`
  )
  console.log(`  to ${notoSansJpTargetDir}`)
}
