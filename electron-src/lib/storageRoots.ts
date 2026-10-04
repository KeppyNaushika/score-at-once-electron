/**
 * データの根。**起動時に1度だけ決め、動いている間は変えない**（issue #1322）。
 *
 * Prisma の接続は起動時に開いたまま張り替わらない。だから「どの DB・どの画像の置き場を
 * 使うか」を途中で変えると、DB と画像が別々の世界を指す。モードやプロファイルを
 * 切り替えたら、再起動して効かせる。
 *
 * 根は3つに分ける。
 *
 * | 根 | ローカルモード | 共有モード |
 * | --- | --- | --- |
 * | DB（`databasePath`） | `data/database.db` | `data/shared/<識別id>/database.db`（手元の控え） |
 * | 共有するファイル（`sharedFilesDirectory`。答案・模範解答・ASB の画像） | `data` | `<共有フォルダ>/files` |
 * | PCに残すもの（`localDataDirectory`。出力・設定・控え） | `data` | `data` |
 *
 * どちらを使うかを決めるのは `sync/startupStorage.ts`。ここは根の形と決まった値を
 * 持つだけで、electron にも設定ファイルにも依存しない。
 */

import * as path from "path"

import {
  getSharedFolderFilesDirectory,
  getSharedReplicaDatabasePath,
} from "./sync/sharedFolder"
import type { SharedProfile, StorageMode } from "./sync/types"

/** 起動時に決まる根 */
export interface StorageRoots {
  /** 動いている間のモード */
  mode: StorageMode
  /** 接続する DB ファイル */
  databasePath: string
  /** 答案・模範解答・ASB の画像の根。DB の `imagePath` はここからの相対パス */
  sharedFilesDirectory: string
  /** PCに残すものの根（実行ファイルの隣の `data`） */
  localDataDirectory: string
  /** 共有モードで使っている共有フォルダ。ローカルモードでは null */
  sharedFolder: SharedProfile | null
}

/** ローカルモードの根 */
export function computeLocalRoots(localDataDirectory: string): StorageRoots {
  return {
    mode: "local",
    databasePath: path.join(localDataDirectory, "database.db"),
    sharedFilesDirectory: localDataDirectory,
    localDataDirectory,
    sharedFolder: null,
  }
}

/** 共有プロファイルの根 */
export function computeSharedRoots(
  localDataDirectory: string,
  profile: SharedProfile
): StorageRoots {
  return {
    mode: "shared",
    databasePath: getSharedReplicaDatabasePath(
      localDataDirectory,
      profile.sharedFolderId
    ),
    sharedFilesDirectory: getSharedFolderFilesDirectory(
      profile.sharedFolderPath
    ),
    localDataDirectory,
    sharedFolder: profile,
  }
}

let fixedRoots: StorageRoots | null = null

/**
 * 根を確定する。**1つの起動で1度だけ呼べる。** 2度目は例外にする —— 途中で根が
 * 変わることを、型ではなく実行時に断る。
 */
export function fixStorageRoots(roots: StorageRoots): void {
  if (fixedRoots !== null) {
    throw new Error(
      "データの根は起動時に1度だけ決める。動いている間に変えることはできない"
    )
  }
  fixedRoots = roots
}

/** 確定した根を返す。確定する前に呼ぶのは起動の順序の誤りなので、例外にする */
export function getStorageRoots(): StorageRoots {
  if (fixedRoots === null) {
    throw new Error(
      "データの根がまだ決まっていない（起動時の準備より前に DB か画像の置き場を参照した）"
    )
  }
  return fixedRoots
}
