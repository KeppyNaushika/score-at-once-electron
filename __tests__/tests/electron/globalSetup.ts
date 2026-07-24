/**
 * Electron e2e のグローバルセットアップ
 *
 * - better-sqlite3 を Electron ABI にそろえる（vitest 実行後は Node ABI になっているため）
 * - メインプロセス／preload をビルドして main/ に出力する
 *
 * 注意: 本 e2e の後に vitest を実行する場合、globalSetup が better-sqlite3 を
 * 自動で Node ABI に戻すため、追加操作は不要。
 */
import { execSync } from "child_process"
import * as path from "path"

const ROOT = path.resolve(__dirname, "../../..")

export default function globalSetup() {
  const run = (command: string) =>
    execSync(command, { cwd: ROOT, stdio: "inherit" })

  // better-sqlite3 を Electron 向けに（冪等スクリプト）
  run("node scripts/ensure-sqlite-abi.js electron")
  // メインプロセス・preload をビルド
  run("node scripts/buildMain.js")
  run("node scripts/buildPreload.js")
}
