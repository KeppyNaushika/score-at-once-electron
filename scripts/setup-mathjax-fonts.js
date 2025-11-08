#!/usr/bin/env node

/**
 * MathJaxのフォント資産をpublic配下へコピーするユーティリティ
 * Electron/OFFLINEビルドでリソース欠損を防ぐ
 */

const fs = require("fs")
const path = require("path")

const repoRoot = path.resolve(__dirname, "..")
const sourceDir = path.join(
  repoRoot,
  "node_modules",
  "mathjax",
  "es5",
  "output",
  "chtml",
  "fonts",
  "woff-v2",
)
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

if (!fs.existsSync(sourceDir)) {
  console.error(`MathJaxフォントのソースが見つかりません: ${sourceDir}`)
  process.exit(1)
}

ensureDir(targetDir)
copyRecursive(sourceDir, targetDir)

console.log("✓ MathJax woff-v2 fonts copied to public assets")
