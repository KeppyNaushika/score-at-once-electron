/**
 * web 版の書き出しを `web-dist/` に作る。
 *
 * 画面はデスクトップ版と同じ静的書き出し（`renderer/`。`next build` が作る）をそのまま使い、
 * 次のものを足す:
 *
 * - 入口（`web/page/entry.ts`）: preload（`electron-src/preload.ts`。無改変）を `electron` だけ
 *   `web/page/electronShim.ts` に差し替えて束ねたもの。すべての HTML（動的ルートの殻を含む）の
 *   `<head>` の先頭に、Next のスクリプトより先に同期で読まれるよう差し込む
 * - 画像を OPFS から返す Service Worker（`web/serviceWorker/serviceWorker.ts`）
 * - main の処理を動かす module Worker（`scripts/web/buildWorker.mjs`）
 *
 * 置き場の URL は `web/page/webAssetPaths.ts` だけが決める。動的ルートの URL の書き換えは
 * 配信側の仕事で、規則の出どころは `src/lib/routeShell.ts` だけ（`scripts/web/serveWeb.mjs`）。
 *
 * 使い方: node scripts/web/buildWeb.mjs [--no-minify]
 * （先に `next build` で `renderer/` を作っておく）
 */
import { build } from "esbuild"
import { access, cp, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { builtinModules } from "node:module"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { tsImport } from "tsx/esm/api"

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

/** 画面の静的書き出し（`next.config.ts` の `RENDERER_EXPORT_DIR`） */
const RENDERER_DIR = path.join(repoRoot, "renderer")

/** web 版の書き出しの置き場 */
export const WEB_DIST_DIR = path.join(repoRoot, "web-dist")

const PAGE_ENTRY = path.join(repoRoot, "web/page/entry.ts")
const ELECTRON_SHIM = path.join(repoRoot, "web/page/electronShim.ts")
const PRELOAD_PROCESS = path.join(repoRoot, "web/page/preloadProcess.ts")
const SERVICE_WORKER_ENTRY = path.join(
  repoRoot,
  "web/serviceWorker/serviceWorker.ts"
)
const BUILD_WORKER_MODULE = path.join(repoRoot, "scripts/web/buildWorker.mjs")

const {
  PAGE_SCRIPT_PATH,
  SERVICE_WORKER_PATH,
  WORKER_DIR_PATH,
  WORKER_SCRIPT_PATH,
} = await tsImport("../../web/page/webAssetPaths.ts", import.meta.url)

/** 書き出しの URL のパスを、`web-dist/` の中のファイルの場所にする */
const toDistPath = (urlPath) => path.join(WEB_DIST_DIR, urlPath.slice(1))

const relativeToRepo = (filePath) => path.relative(repoRoot, filePath)

const exists = async (filePath) => {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * 画面で動く束に Node の依存が入ったら失敗させる。`electron` だけは差し替え先を指す。
 * preload は画面と main の間の薄い層なので、npm の依存も入らないはず（入ったら止める）
 */
const browserOnlyPlugin = (electronShimPath) => ({
  name: "web-browser-only",
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^electron$/ }, () => ({
      path: electronShimPath,
    }))
    pluginBuild.onResolve({ filter: /.*/ }, (args) => {
      const moduleName = args.path.replace(/^node:/, "").split("/")[0]
      if (
        args.path.startsWith("node:") ||
        builtinModules.includes(moduleName)
      ) {
        return {
          errors: [
            {
              text: `Node の組み込み "${args.path}" は画面では動きません（${relativeToRepo(args.importer)} から）`,
            },
          ],
        }
      }
      return undefined
    })
  },
})

const assertNoPackageInputs = (metafile, bundleName) => {
  const packageInputs = Object.keys(metafile.inputs).filter((inputPath) =>
    inputPath.split(/[\\/]/).includes("node_modules")
  )
  if (packageInputs.length > 0) {
    throw new Error(
      `${bundleName} に npm の依存が入りました。画面で動く束には入れない:\n  ${packageInputs.join("\n  ")}`
    )
  }
}

const buildBrowserBundle = async ({
  bundleName,
  entryPoint,
  outfile,
  minify,
  inject = [],
}) => {
  const result = await build({
    entryPoints: [entryPoint],
    outfile,
    bundle: true,
    platform: "browser",
    format: "iife",
    target: "es2022",
    minify,
    sourcemap: false,
    legalComments: "none",
    metafile: true,
    logLevel: "warning",
    inject,
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    tsconfig: path.join(repoRoot, "tsconfig.json"),
    plugins: [browserOnlyPlugin(ELECTRON_SHIM)],
  })
  assertNoPackageInputs(result.metafile, bundleName)
}

const listHtmlFiles = async (directory) => {
  const entries = await readdir(directory, {
    recursive: true,
    withFileTypes: true,
  })
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
    .map((entry) => path.join(entry.parentPath, entry.name))
}

const HEAD_OPEN_TAG = /<head(\s[^>]*)?>/i

/** 入口を `<head>` の先頭に差し込む。`async` を付けないので、後に続く Next のスクリプトより先に動く */
const injectPageScript = async (htmlPath) => {
  const html = await readFile(htmlPath, "utf8")
  const headOpenTag = html.match(HEAD_OPEN_TAG)
  if (!headOpenTag) {
    throw new Error(`<head> がありません: ${relativeToRepo(htmlPath)}`)
  }
  const pageScriptTag = `<script src="${PAGE_SCRIPT_PATH}"></script>`
  await writeFile(
    htmlPath,
    html.replace(HEAD_OPEN_TAG, (headTag) => headTag + pageScriptTag)
  )
}

const buildWorkerBundle = async (minify) => {
  if (!(await exists(BUILD_WORKER_MODULE))) {
    throw new Error(
      `${relativeToRepo(BUILD_WORKER_MODULE)} がありません。main の処理を動かす Worker を書き出せないので、web 版はまだ動きません（画面・Service Worker は ${relativeToRepo(WEB_DIST_DIR)} に書き出し済み）。`
    )
  }
  const { buildWorker } = await import(pathToFileURL(BUILD_WORKER_MODULE).href)
  if (typeof buildWorker !== "function") {
    throw new Error(
      `${relativeToRepo(BUILD_WORKER_MODULE)} が buildWorker を export していません。`
    )
  }
  await buildWorker({ outDir: toDistPath(WORKER_DIR_PATH), minify })
  if (!(await exists(toDistPath(WORKER_SCRIPT_PATH)))) {
    throw new Error(
      `buildWorker のあとに ${WORKER_SCRIPT_PATH} がありません（web/page/webAssetPaths.ts の名前と揃える）。`
    )
  }
}

export async function buildWeb({ minify }) {
  if (!(await exists(path.join(RENDERER_DIR, "index.html")))) {
    throw new Error(
      `${relativeToRepo(RENDERER_DIR)}/ がありません。先に next build で画面を書き出してください。`
    )
  }
  await rm(WEB_DIST_DIR, { recursive: true, force: true })
  await cp(RENDERER_DIR, WEB_DIST_DIR, { recursive: true })

  await buildBrowserBundle({
    bundleName: "入口（preload の束）",
    entryPoint: PAGE_ENTRY,
    outfile: toDistPath(PAGE_SCRIPT_PATH),
    minify,
    inject: [PRELOAD_PROCESS],
  })
  await buildBrowserBundle({
    bundleName: "Service Worker",
    entryPoint: SERVICE_WORKER_ENTRY,
    outfile: toDistPath(SERVICE_WORKER_PATH),
    minify,
  })

  const htmlFiles = await listHtmlFiles(WEB_DIST_DIR)
  await Promise.all(htmlFiles.map(injectPageScript))
  console.log(
    `web-dist: 画面を写し、${htmlFiles.length} 枚の HTML に入口を差し込みました`
  )

  await buildWorkerBundle(minify)
  console.log("web-dist: Worker を書き出しました")
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  buildWeb({ minify: !process.argv.includes("--no-minify") }).catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
