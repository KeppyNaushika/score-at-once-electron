/**
 * 共有フォルダの中身の決まりと、手元の控えの置き場
 *
 * 共有フォルダ（利用者が選ぶ）の中はアプリが作り、利用者には触らせない。
 *
 * ```
 * <共有フォルダ>/
 *   score-at-once-shared-folder.json   識別ファイル（sharedFolderId: uuidv4）
 *   sync/client-<clientId>.sqlite      同期の写し（sqlite-nas-sync が置く）
 *   files/exams/...                    答案・模範解答の画像
 *   files/answer-sheet-builder/...     ASB の画像
 * ```
 *
 * 手元の控えは `data/shared/<sharedFolderId>/database.db`。**パスではなく識別ファイルの
 * id で分ける**（PCごとにドライブ文字や UNC の表記が違うので、パスでは同じフォルダと
 * 分からない）。
 */

import * as fs from "fs"
import * as path from "path"

/** 識別ファイルの名前 */
export const SHARED_FOLDER_MARKER_FILE_NAME = "score-at-once-shared-folder.json"

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** 共有フォルダの同期の写しの置き場 */
export const getSharedFolderSyncDirectory = (
  sharedFolderPath: string
): string => path.join(sharedFolderPath, "sync")

/** 共有フォルダの画像の置き場（共有モードの「共有するファイルの根」） */
export const getSharedFolderFilesDirectory = (
  sharedFolderPath: string
): string => path.join(sharedFolderPath, "files")

/** 識別ファイルのパス */
export const getSharedFolderMarkerPath = (sharedFolderPath: string): string =>
  path.join(sharedFolderPath, SHARED_FOLDER_MARKER_FILE_NAME)

/** 共有プロファイルの手元の控えのディレクトリ */
export const getSharedReplicaDirectory = (
  localDataDirectory: string,
  sharedFolderId: string
): string => path.join(localDataDirectory, "shared", sharedFolderId)

/** 共有プロファイルの手元の控え（DB） */
export const getSharedReplicaDatabasePath = (
  localDataDirectory: string,
  sharedFolderId: string
): string =>
  path.join(
    getSharedReplicaDirectory(localDataDirectory, sharedFolderId),
    "database.db"
  )

/** 共有するファイル（画像）のうち、移行で丸写しするディレクトリ（根からの相対） */
export const SHARED_FILE_DIRECTORIES = [
  "exams",
  "answer-sheet-builder",
] as const

/**
 * 共有フォルダを見た結果。
 *
 * - `unreachable`: フォルダが無い・読めない
 * - `empty`: 共有しているものが無い。識別ファイルも同期の写しも無く、画像の置き場も空
 * - `shared`: 識別ファイルがある（既に共有されている）
 * - `unusable`: 識別ファイルが壊れている、または識別ファイルが無いのに写しや画像がある
 */
export type SharedFolderInspection =
  | { kind: "unreachable"; reason: string }
  | { kind: "empty" }
  | { kind: "shared"; sharedFolderId: string }
  | { kind: "unusable"; reason: string }

/**
 * 識別ファイルを読む。無ければ null。中身が壊れていれば例外。
 */
export function readSharedFolderId(sharedFolderPath: string): string | null {
  const markerPath = getSharedFolderMarkerPath(sharedFolderPath)
  if (!fs.existsSync(markerPath)) return null
  const raw: unknown = JSON.parse(fs.readFileSync(markerPath, "utf-8"))
  const sharedFolderId =
    typeof raw === "object" && raw !== null && "sharedFolderId" in raw
      ? raw.sharedFolderId
      : null
  if (
    typeof sharedFolderId !== "string" ||
    !UUID_V4_PATTERN.test(sharedFolderId)
  ) {
    throw new Error(`識別ファイルの中身が読めない: ${markerPath}`)
  }
  return sharedFolderId
}

/**
 * 識別ファイルを書く。**既にあれば失敗する**（`wx`）。同時に2台が同じフォルダを
 * 用意しかけても、片方の識別ファイルを上書きしない。
 */
export function writeSharedFolderMarker(
  sharedFolderPath: string,
  sharedFolderId: string
): void {
  fs.writeFileSync(
    getSharedFolderMarkerPath(sharedFolderPath),
    JSON.stringify(
      { sharedFolderId, createdAt: new Date().toISOString() },
      null,
      2
    ),
    { encoding: "utf-8", flag: "wx" }
  )
}

/** 同期の写し（`client-*.sqlite`）があるか */
export function hasSyncCopies(sharedFolderPath: string): boolean {
  const syncDirectory = getSharedFolderSyncDirectory(sharedFolderPath)
  if (!fs.existsSync(syncDirectory)) return false
  return fs
    .readdirSync(syncDirectory)
    .some((entryName) => /^client-.+\.sqlite$/.test(entryName))
}

const isNonEmptyDirectory = (directoryPath: string): boolean =>
  fs.existsSync(directoryPath) && fs.readdirSync(directoryPath).length > 0

/** 共有フォルダを見る。読むだけで、何も書かない */
export function inspectSharedFolder(
  sharedFolderPath: string
): SharedFolderInspection {
  try {
    if (!fs.statSync(sharedFolderPath).isDirectory()) {
      return { kind: "unreachable", reason: "フォルダではありません" }
    }
    fs.readdirSync(sharedFolderPath)
  } catch (error) {
    return {
      kind: "unreachable",
      reason: error instanceof Error ? error.message : String(error),
    }
  }

  let sharedFolderId: string | null
  try {
    sharedFolderId = readSharedFolderId(sharedFolderPath)
  } catch (error) {
    return {
      kind: "unusable",
      reason: error instanceof Error ? error.message : String(error),
    }
  }
  if (sharedFolderId !== null) return { kind: "shared", sharedFolderId }

  if (hasSyncCopies(sharedFolderPath)) {
    return {
      kind: "unusable",
      reason:
        "識別ファイルが無いのに、同期の写しがあります（一括採点の共有フォルダが壊れているか、別の版で作られたものです）",
    }
  }
  if (isNonEmptyDirectory(getSharedFolderFilesDirectory(sharedFolderPath))) {
    return {
      kind: "unusable",
      reason: "識別ファイルが無いのに、画像の置き場（files）に中身があります",
    }
  }
  return { kind: "empty" }
}
