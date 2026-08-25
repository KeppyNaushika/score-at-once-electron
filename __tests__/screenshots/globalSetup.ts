/**
 * 撮影 e2e のグローバルセットアップ
 *
 * - 前回の出力を消す（`SCREENSHOTS_DIR`）
 * - 素の Node 向け better-sqlite3 の退避コピーを用意し、node_modules 側は
 *   Electron 向けへそろえる（理由と仕組みは `helpers/nodeAbiBinding.ts`）
 * - メインプロセス／preload をビルドして `main/` に出力する。撮影は
 *   `main/electron-src/index.js` を起動するので、これが古いと古いアプリを撮る
 * - DB パスの照合に使う小さな束を作り直す（`helpers/databasePathProbe.ts`）
 *
 * 撮影のあとツリーは Electron 向けのまま残る（`npm run dev` はこれを要求する）。
 * vitest を走らせる場合は vitest 側の globalSetup が素の Node 向けへ戻すので、
 * 追加の操作は要らない（Electron e2e と同じ）。
 */
import { execFileSync } from "child_process"
import * as fs from "fs"
import * as path from "path"

import { buildDatabasePathProbe } from "./helpers/databasePathProbe"
import { ensureNodeAbiBinding } from "./helpers/nodeAbiBinding"
import { SCREENSHOTS_DIR } from "./helpers/screenshotPaths"

const PROJECT_ROOT = path.resolve(__dirname, "../..")

export default async function globalSetup() {
  // 出力を丸ごと消してから撮り始める。
  //
  // 消さないと**今回撮れなかった画像の位置に前回の画像が残る**。画像を見る人には
  // 「撮れている」ようにしか見えないので、古い UI の絵を今の UI だと思って読むことに
  // なる（実際、3月の絵が10枚そのまま残っていた）。出力に在るものは常に**この実行で
  // 撮れたものだけ**、という状態を保つ。
  fs.rmSync(SCREENSHOTS_DIR, { recursive: true, force: true })
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })

  const runScript = (scriptPath: string, ...args: string[]) =>
    execFileSync(
      process.execPath,
      [path.join(PROJECT_ROOT, scriptPath), ...args],
      { cwd: PROJECT_ROOT, stdio: "inherit" }
    )

  // 種蒔き（screenshot:setup）が素の Node 向けをそろえた直後なので、たいていは
  // ファイルコピーだけで済む
  ensureNodeAbiBinding()

  runScript("scripts/buildMain.js")
  runScript("scripts/buildPreload.js")

  // 「アプリが実際に開く DB はどれか」を訊くための小さな束（helpers/databasePathProbe.ts）
  await buildDatabasePathProbe()

  // node_modules 側は Electron 向けにする（アプリが DB を開けるように）
  runScript("scripts/ensure-sqlite-abi.js", "electron")
}
