/**
 * web 版の module Worker（main のハンドラを動かす側）を束ねる。
 *
 *   node scripts/web/buildWorker.mjs <outDir>
 *
 * `outDir` に次を書く（すべて同じディレクトリに置く。wasm は Worker の位置からの相対で取る）:
 * - worker.js                    … 入口 `web/worker/backend.ts` を束ねたもの（module Worker）
 * - query_compiler_fast_bg.wasm  … Prisma のクエリコンパイラ（`generated/prisma-web`）
 * - sqlite3.wasm                 … sqlite-wasm 本体
 * - vips-es6.js・vips.wasm        … 画像処理の wasm-vips（束ねずに写す。初めて画像を扱うときに読む）
 *
 * main のコードは書き換えず、Node・Electron 専用のモジュールを下の差し替え表で置き換える。
 * 表に無い Node の組み込みモジュールを読むコードが入ったら、黙って束ねずに失敗させる
 * （差し替えを決めてから表に足す）。
 */
import { build } from "esbuild"
import { existsSync } from "node:fs"
import { copyFile, mkdir, readFile } from "node:fs/promises"
import { builtinModules } from "node:module"
import * as path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)
const workerSourceDirectory = path.join(repositoryRoot, "web/worker")
const webPrismaClientDirectory = path.join(
  repositoryRoot,
  "generated/prisma-web"
)
const nodeModulesDirectory = path.join(repositoryRoot, "node_modules")

const QUERY_COMPILER_WASM = "query_compiler_fast_bg.wasm"
const SQLITE_WASM = "sqlite3.wasm"
/** wasm-vips の本体と wasm（HEIF・JPEG XL の追加の wasm は読まないので写さない） */
const VIPS_FILES = ["vips-es6.js", "vips.wasm"]

/** 差し替え表: 読み込むモジュール名 → 代わりに束ねるファイル */
const MODULE_REPLACEMENTS = {
  // Electron（ipcMain・dialog・app.getPath など。web/worker/electronShim.ts）
  electron: path.join(workerSourceDirectory, "electronShim.ts"),
  // ファイル: OPFS の実ファイルの階層。同期版は呼ばれたら分かる例外
  fs: path.join(workerSourceDirectory, "nodeFsShim.ts"),
  "fs/promises": path.join(workerSourceDirectory, "opfsFs.ts"),
  os: path.join(workerSourceDirectory, "osShim.ts"),
  crypto: path.join(workerSourceDirectory, "cryptoShim.ts"),
  path: path.join(nodeModulesDirectory, "path-browserify/index.js"),
  buffer: path.join(nodeModulesDirectory, "buffer/index.js"),
  events: path.join(nodeModulesDirectory, "events/events.js"),
  // アプリの DB（sqlite-wasm）を better-sqlite3 の形に包む。Prisma のアダプタ
  // （@prisma/adapter-better-sqlite3）とマイグレーションはこれを通してそのまま動く
  "better-sqlite3": path.join(workerSourceDirectory, "betterSqlite3Shim.ts"),
  // 同じハッシュ形式（$2b$）の純 JS 版
  bcrypt: path.join(nodeModulesDirectory, "bcryptjs/index.js"),
  // workerd 向けに生成した Prisma クライアント（schema.prisma の generator webClient）
  "@prisma/client": path.join(webPrismaClientDirectory, "client.ts"),
}

/**
 * 差し替え表（main のファイル）: 窓口のファイル → web 版の裏。窓口だけを替え、呼び出す側は
 * デスクトップ版と同じコードのまま束ねる
 */
const SOURCE_REPLACEMENTS = {
  // 印刷・PDF出力: オフスクリーンのウィンドウの代わりに画面の印刷ダイアログ
  [path.join(repositoryRoot, "electron-src/lib/printUtils.ts")]: path.join(
    workerSourceDirectory,
    "htmlPrinting.ts"
  ),
  // 画像処理: sharp の代わりに wasm-vips（同じ libvips。出力はバイト単位で一致する）
  [path.join(repositoryRoot, "electron-src/lib/imageOps.ts")]: path.join(
    workerSourceDirectory,
    "imageOpsVips.ts"
  ),
}

/**
 * web 版では未対応のモジュール: 名前 → 名前付きの口（default は必ず置く）。
 * 読み込むだけでは落ちず、呼ぶと「[web] <名前> は web 版では未対応」を投げる
 */
const UNSUPPORTED_MODULES = {
  "adm-zip": [],
  "sqlite-nas-sync": ["setupSync", "removeSync"],
}

const UNSUPPORTED_NAMESPACE = "web-unsupported"
const WASM_NAMESPACE = "web-wasm"

/** `import("./query_compiler_fast_bg.wasm?module")` の代わり。Worker の隣の wasm をコンパイルする */
const queryCompilerModuleSource = `
const wasmUrl = new URL(${JSON.stringify(`./${QUERY_COMPILER_WASM}`)}, import.meta.url)
// Prisma の生成物は default を await して WebAssembly.Module として使う（Promise でも
// 呼び出し側の async 関数が解く）。Content-Type に依らないよう、バイト列からコンパイルする
export default fetch(wasmUrl).then((response) => {
  if (!response.ok) throw new Error("[web] " + wasmUrl + " を読めない（" + response.status + "）")
  return response.arrayBuffer()
}).then((bytes) => WebAssembly.compile(bytes))
`

const unsupportedModuleSource = (moduleName) => {
  const helperPath = JSON.stringify(
    path.join(workerSourceDirectory, "unsupportedModule.ts")
  )
  const namedExports = UNSUPPORTED_MODULES[moduleName]
    .map(
      (exportName) =>
        `export const ${exportName} = unsupportedExport(${JSON.stringify(moduleName)}, ${JSON.stringify(exportName)})`
    )
    .join("\n")
  return `import { unsupportedExport } from ${helperPath}
export default unsupportedExport(${JSON.stringify(moduleName)})
${namedExports}
`
}

const isNodeBuiltin = (moduleName) =>
  builtinModules.includes(moduleName.split("/")[0])

/** 差し替えを行う esbuild のプラグイン。差し替えた先と、それを読んだモジュールを記録する */
const createReplacementPlugin = (replacementLog) => ({
  name: "score-at-once-web-worker",
  setup(pluginBuild) {
    const record = (moduleName, importer) => {
      const importers = replacementLog.get(moduleName) ?? new Set()
      importers.add(path.relative(repositoryRoot, importer))
      replacementLog.set(moduleName, importers)
    }

    pluginBuild.onResolve({ filter: /\.wasm\?module$/ }, (args) => ({
      path: args.path,
      namespace: WASM_NAMESPACE,
    }))
    pluginBuild.onLoad({ filter: /.*/, namespace: WASM_NAMESPACE }, (args) => {
      if (!args.path.endsWith(`${QUERY_COMPILER_WASM}?module`)) {
        throw new Error(`[web] 想定していない wasm の読み込み: ${args.path}`)
      }
      return { contents: queryCompilerModuleSource, loader: "js" }
    })

    pluginBuild.onResolve({ filter: /^\.\.?\// }, (args) => {
      const sourcePath = path.resolve(args.resolveDir, args.path)
      const replacedPath = [sourcePath, `${sourcePath}.ts`].find(
        (candidatePath) => candidatePath in SOURCE_REPLACEMENTS
      )
      if (replacedPath === undefined) return undefined
      record(path.relative(repositoryRoot, replacedPath), args.importer)
      return { path: SOURCE_REPLACEMENTS[replacedPath] }
    })

    pluginBuild.onResolve({ filter: /^[^./]/ }, (args) => {
      const moduleName = args.path.replace(/^node:/, "")
      if (moduleName in MODULE_REPLACEMENTS) {
        record(moduleName, args.importer)
        return { path: MODULE_REPLACEMENTS[moduleName] }
      }
      if (moduleName in UNSUPPORTED_MODULES) {
        record(moduleName, args.importer)
        return { path: moduleName, namespace: UNSUPPORTED_NAMESPACE }
      }
      if (isNodeBuiltin(moduleName)) {
        return {
          errors: [
            {
              text: `Node の組み込みモジュール "${args.path}" の差し替えが無い（${path.relative(repositoryRoot, args.importer)}）。scripts/web/buildWorker.mjs の差し替え表に足す`,
            },
          ],
        }
      }
      return undefined
    })
    pluginBuild.onLoad(
      { filter: /.*/, namespace: UNSUPPORTED_NAMESPACE },
      (args) => ({
        contents: unsupportedModuleSource(args.path),
        loader: "js",
        resolveDir: workerSourceDirectory,
      })
    )
  },
})

/**
 * Worker を束ねて `outDir` に書く。
 *
 * @param {{ outDir: string, minify?: boolean }} options
 * @returns {Promise<{ replacements: Record<string, string[]>, outputBytes: number }>}
 *   差し替えたモジュールと、それを読んだモジュール（相対パス）・worker.js の大きさ
 */
export async function buildWorker({ outDir, minify = false }) {
  if (!existsSync(path.join(webPrismaClientDirectory, "client.ts"))) {
    throw new Error(
      "generated/prisma-web が無い。`npx prisma generate` で web 用のクライアントを生成する"
    )
  }
  await mkdir(outDir, { recursive: true })

  // Worker に要るのは版と名前だけ。package.json を丸ごと束ねず、この2つを埋め込む
  // （`web/worker/electronShim.ts` の `__APP_VERSION__`・`__APP_NAME__`）
  const packageJson = JSON.parse(
    await readFile(path.join(repositoryRoot, "package.json"), "utf-8")
  )

  const replacementLog = new Map()
  const result = await build({
    absWorkingDir: repositoryRoot,
    entryPoints: [path.join(workerSourceDirectory, "backend.ts")],
    outfile: path.join(outDir, "worker.js"),
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    minify,
    metafile: true,
    logLevel: "warning",
    define: {
      "process.env.NODE_ENV": JSON.stringify("production"),
      global: "globalThis",
      __APP_VERSION__: JSON.stringify(packageJson.version),
      __APP_NAME__: JSON.stringify(packageJson.name),
    },
    plugins: [createReplacementPlugin(replacementLog)],
  })

  await Promise.all([
    copyFile(
      path.join(webPrismaClientDirectory, "internal", QUERY_COMPILER_WASM),
      path.join(outDir, QUERY_COMPILER_WASM)
    ),
    copyFile(
      path.join(
        nodeModulesDirectory,
        "@sqlite.org/sqlite-wasm/dist",
        SQLITE_WASM
      ),
      path.join(outDir, SQLITE_WASM)
    ),
    // wasm-vips は束ねずに写す（pthread の Worker を自分の URL から起動するため。
    // `web/worker/vipsRuntime.ts`）
    ...VIPS_FILES.map((fileName) =>
      copyFile(
        path.join(nodeModulesDirectory, "wasm-vips/lib", fileName),
        path.join(outDir, fileName)
      )
    ),
  ])

  const outputBytes = Object.values(result.metafile.outputs).reduce(
    (total, output) => total + output.bytes,
    0
  )
  return {
    replacements: Object.fromEntries(
      [...replacementLog].map(([moduleName, importers]) => [
        moduleName,
        [...importers].sort(),
      ])
    ),
    outputBytes,
  }
}

const isRunDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href

if (isRunDirectly) {
  const outDir = process.argv[2]
  if (!outDir) {
    console.error(
      "使い方: node scripts/web/buildWorker.mjs <outDir> [--minify]"
    )
    process.exit(1)
  }
  const { replacements, outputBytes } = await buildWorker({
    outDir: path.resolve(outDir),
    minify: process.argv.includes("--minify"),
  })
  console.log(`worker.js: ${(outputBytes / 1024 / 1024).toFixed(1)} MB`)
  for (const [moduleName, importers] of Object.entries(replacements)) {
    console.log(`  ${moduleName} ← ${importers.length} モジュール`)
  }
}
