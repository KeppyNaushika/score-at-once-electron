/**
 * 同期が有効なときに撮影を止める番人
 *
 * `getDatabasePath()`（`electron-src/lib/prisma/databaseInitializer.ts`）は同期が
 * 有効だと `SCORE_AT_ONCE_DATA_DIR` を無視して userData 配下のローカル DB を返す。
 * アプリの挙動としてはこれが正しい（同期時に接続すべきなのは NAS 上の DB ではなく
 * 手元の DB）。だが撮影から見ると、画像だけ撮影用ディレクトリを向いたまま
 * **実運用のデータベースに繋がる**ということなので、止めるのは撮影の側の仕事になる。
 *
 * 同期設定は DB ではなく userData の `sync-config.json` にあり、撮影用ディレクトリ
 * からは見えない。ここではその置き場を Electron と同じ規則で組み立てて先回りに読む
 * （撮影用 DB を作ってから使われないと分かる、という無駄を避けるため）。
 *
 * **こちらは先回りの判定でしかない。** 置き場の組み立てが外れれば設定を読み落として
 * 素通りする。最後の砦は撮影側で、起動したアプリ自身に「実際に開いた DB」を訊いて
 * 突き合わせる（`take-screenshots.spec.ts`）。
 */

import * as fs from "fs"
import * as os from "os"
import * as path from "path"

const PROJECT_ROOT = path.resolve(__dirname, "../../..")

/**
 * Electron の `app.getName()` と同じ規則でアプリ名を決める
 * （`productName` があればそれ、無ければ `name`）。
 */
function getElectronAppName(): string {
  const packageJson: { productName?: string; name?: string } = JSON.parse(
    fs.readFileSync(path.join(PROJECT_ROOT, "package.json"), "utf-8")
  )
  return packageJson.productName ?? packageJson.name ?? "Electron"
}

/** Electron の `app.getPath("userData")` と同じ場所を組み立てる */
function getUserDataDirectory(): string {
  const appName = getElectronAppName()
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", appName)
  }
  if (process.platform === "win32") {
    return path.join(
      process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming"),
      appName
    )
  }
  return path.join(
    process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config"),
    appName
  )
}

/** 同期設定ファイル（`syncConfig.ts` の `getConfigPath()` と同じ場所）のパス */
export function getSyncConfigPath(): string {
  return path.join(getUserDataDirectory(), "sync-config.json")
}

/**
 * 同期が有効かどうかを userData の設定ファイルから読む
 *
 * 設定ファイルが無い・壊れているときは無効とみなす（アプリ側の
 * `loadSyncConfig()` も既定値 `enabled: false` を返す）。
 */
export function isSyncEnabled(): boolean {
  const configPath = getSyncConfigPath()
  if (!fs.existsSync(configPath)) return false
  try {
    const syncConfig: { enabled?: boolean } = JSON.parse(
      fs.readFileSync(configPath, "utf-8")
    )
    return syncConfig.enabled === true
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
    "同期が有効なので撮影を中止します。実運用のデータベースに繋がるためです。",
    "アプリの 設定 → 同期設定 で同期を無効にしてから撮り直してください。",
    detail,
  ].join("\n")
}
