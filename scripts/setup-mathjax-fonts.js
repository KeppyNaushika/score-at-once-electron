#!/usr/bin/env node

/**
 * MathJaxのフォント資産をpublic配下へコピーするユーティリティ
 * Electron/OFFLINEビルドでリソース欠損を防ぐ
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
  "woff-v2",
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

const sourceDir =
  CANDIDATE_PATHS.map((segments) =>
    path.join(repoRoot, "node_modules", ...segments),
  ).find((candidate) => fs.existsSync(candidate))

if (!sourceDir) {
  console.error(
    "MathJaxフォントのソースが見つかりません: " +
      CANDIDATE_PATHS.map((segments) =>
        path.join("node_modules", ...segments),
      ).join(", "),
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
