/**
 * web 版の書き出し（`web-dist/`）に、画面の静的書き出しへ足して置くファイルの URL。
 * 書き出し（`scripts/web/buildWeb.mjs`）と入口（`web/page/entry.ts`）の両方がここを読む。
 *
 * 画面の静的書き出しの URL（`/_next/...`・各画面のパス）と重ならない名前にする。
 */

/** 入口（preload の束を含む）。すべての HTML の `<head>` の先頭に差し込む */
export const PAGE_SCRIPT_PATH = "/__web/page.js"

/** main の処理を動かす module Worker の置き場（`buildWorker` の `outDir`） */
export const WORKER_DIR_PATH = "/__web/worker"

/** module Worker の本体 */
export const WORKER_SCRIPT_PATH = `${WORKER_DIR_PATH}/worker.js`

/**
 * 配っている版の知らせ（`{ "buildId": … }`）。開いている間に新しい版が配られたかを、
 * 画面がこれを読んで確かめる（`web/webBuild.ts`）
 */
export const WEB_BUILD_INFO_PATH = "/__web/build.json"

/**
 * 画像を OPFS から返す Service Worker。`/` 全体を受け持つには置き場がオリジンの直下で
 * なければならない（`Service-Worker-Allowed` ヘッダーを要らなくするため）
 */
export const SERVICE_WORKER_PATH = "/serviceWorker.js"
