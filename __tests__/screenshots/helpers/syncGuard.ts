/**
 * 共有モードの設定で撮影を止める番人
 *
 * 撮影は `SCORE_AT_ONCE_DATA_DIR` で data を撮影用ディレクトリに差し替えて起動する。
 * モードの設定（`sync-config.json`）もその data の中にあるので、そこが共有モードを
 * 指していると、アプリは撮影用の `database.db` ではなく共有プロファイルの手元の控えを
 * 開き、画像も共有フォルダから読む。止めるのは撮影の側の仕事になる。
 *
 * **こちらは先回りの判定でしかない。** 最後の砦は撮影側で、起動したアプリ自身に
 * 「実際に開いた DB」を訊いて突き合わせる（`take-screenshots.spec.ts`）。
 */

import * as fs from "fs"
import * as path from "path"

/** 撮影用 data の設定ファイル（`electron-src/lib/sync/syncConfig.ts` と同じ場所） */
export function getSyncConfigPath(dataDirectory: string): string {
  return path.join(dataDirectory, "sync-config.json")
}

/**
 * 撮影用 data の設定が共有モードを指しているか
 *
 * 設定ファイルが無い・壊れているときはローカルモードとみなす（アプリ側の
 * `loadSyncConfig()` も既定値のローカルモードを返す）。
 */
export function isSharedModeConfigured(dataDirectory: string): boolean {
  const configPath = getSyncConfigPath(dataDirectory)
  if (!fs.existsSync(configPath)) return false
  try {
    const raw: unknown = JSON.parse(fs.readFileSync(configPath, "utf-8"))
    return (
      typeof raw === "object" &&
      raw !== null &&
      "mode" in raw &&
      raw.mode === "shared"
    )
  } catch {
    return false
  }
}

/**
 * 中止の理由と直し方を日本語で組み立てる
 *
 * @param detail - 何を見て中止したか（設定ファイル／実際に開かれた DB のパス等）
 */
export function describeSyncAbort(detail: string): string {
  return [
    "撮影用のデータが共有モードを指しているので撮影を中止します。撮影用の DB ではないデータベースに繋がるためです。",
    "撮影用 data の sync-config.json を消すか、ローカルモードにしてから撮り直してください。",
    detail,
  ].join("\n")
}
