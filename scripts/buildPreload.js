/**
 * preload.tsをesbuildで単一ファイルにバンドル
 *
 * sandbox: true のElectronレンダラーではrequire()が使えないため、
 * preloadスクリプトの全モジュールを1ファイルにバンドルする必要がある。
 */
const esbuild = require("esbuild")
const path = require("path")

async function buildPreload() {
  await esbuild.build({
    entryPoints: [path.join(__dirname, "../electron-src/preload.ts")],
    bundle: true,
    platform: "node",
    target: "es2022",
    outfile: path.join(__dirname, "../main/electron-src/preload.js"),
    external: ["electron"],
    format: "cjs",
    sourcemap: false,
  })
}

buildPreload().catch((err) => {
  console.error("Failed to build preload:", err)
  process.exit(1)
})
