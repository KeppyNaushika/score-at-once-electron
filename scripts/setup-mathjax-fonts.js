#!/usr/bin/env node

/**
 * フォント・アセットセットアップスクリプト
 * Electron/OFFLINEビルドでリソース欠損を防ぐ
 *
 * コピーされるアセット:
 * - MathJax woff-v2 フォント（数式表示用）
 * - PDF.js Worker（PDF変換用）
 * - Noto Sans JP フォント（個人成績表PDF用）
 */

const fs = require("fs")
const path = require("path")

const repoRoot = path.resolve(__dirname, "..")
const CANDIDATE_PATHS = [
  ["mathjax", "es5", "output", "chtml", "fonts", "woff-v2"],
  ["mathjax", "output", "chtml", "fonts", "woff-v2"],
  ["mathjax-full", "es5", "output", "chtml", "fonts", "woff-v2"],
]
const targetDir = path.join(
  repoRoot,
  "public",
  "js",
  "mathjax",
  "output",
  "chtml",
  "fonts",
  "woff-v2"
)

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

const sourceDir = CANDIDATE_PATHS.map((segments) =>
  path.join(repoRoot, "node_modules", ...segments)
).find((candidate) => fs.existsSync(candidate))

if (!sourceDir) {
  console.error(
    "MathJaxフォントのソースが見つかりません: " +
      CANDIDATE_PATHS.map((segments) =>
        path.join("node_modules", ...segments)
      ).join(", ")
  )
  process.exit(1)
}

console.log(`✓ MathJax font source: ${sourceDir}`)

ensureDir(targetDir)
copyRecursive(sourceDir, targetDir)

console.log("✓ MathJax woff-v2 fonts copied to public assets")

// PDF.js workerファイルのセットアップ
const pdfWorkerSource = path.join(
  repoRoot,
  "node_modules",
  "pdfjs-dist",
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
