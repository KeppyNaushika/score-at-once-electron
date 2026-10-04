const esbuild = require("esbuild")
const fs = require("fs")
const path = require("path")

const MAIN_DIR = path.join(__dirname, "../main")

/**
 * main/ に残してよいファイル（main からの相対パス）。
 *
 * main/ は配布物にそのまま入る。ここに無いものは以前の組み立てや tsc の出力の
 * 置き土産で、改名前の名前のファイルや、別名（`@/…`）が解決されていない出力が
 * 混ざっていた。束を作り直したあとで、これ以外を消す。
 *
 * main/ を丸ごと消してから作らないのは、並行して動いている開発中のアプリが
 * preload.js を読みに来ることがあるため（消している間だけ見つからなくなる）。
 */
const MAIN_OUTPUTS = new Set([
  "electron-src/index.js",
  "electron-src/index.js.map",
  "electron-src/preload.js", // scripts/buildPreload.js が作る
])

const removeStaleOutputs = () => {
  if (!fs.existsSync(MAIN_DIR)) return
  const entries = fs.readdirSync(MAIN_DIR, { recursive: true })
  for (const entry of entries) {
    const relativePath = entry.split(path.sep).join("/")
    const entryPath = path.join(MAIN_DIR, entry)
    if (!fs.existsSync(entryPath) || fs.statSync(entryPath).isDirectory()) {
      continue
    }
    if (!MAIN_OUTPUTS.has(relativePath)) fs.rmSync(entryPath)
  }
  // 空になったディレクトリを深い順に消す
  const directories = entries
    .map((entry) => path.join(MAIN_DIR, entry))
    .filter((entryPath) => fs.existsSync(entryPath))
    .filter((entryPath) => fs.statSync(entryPath).isDirectory())
    .sort((left, right) => right.length - left.length)
  for (const directory of directories) {
    if (fs.readdirSync(directory).length === 0) fs.rmdirSync(directory)
  }
}

const prismaClientPlugin = {
  name: "prisma-client-alias",
  setup(build) {
    build.onResolve({ filter: /^@prisma\/client$/ }, () => {
      return { path: path.resolve(__dirname, "../generated/prisma/client.ts") }
    })
  },
}

async function buildMain() {
  await esbuild.build({
    entryPoints: [path.join(__dirname, "../electron-src/index.ts")],
    bundle: true,
    platform: "node",
    target: "es2022",
    outdir: path.join(__dirname, "../main/electron-src"),
    format: "cjs",
    sourcemap: true,
    packages: "external",
    plugins: [prismaClientPlugin],
    banner: {
      js: 'var __import_meta_url = require("url").pathToFileURL(__filename).href;',
    },
    define: {
      "import.meta.url": "__import_meta_url",
    },
  })
  removeStaleOutputs()
}

buildMain().catch((err) => {
  console.error("Failed to build main:", err)
  process.exit(1)
})
