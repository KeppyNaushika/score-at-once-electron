/**
 * 統合アーカイブ（.sao）のファイルをデータディレクトリへ写す
 *
 * `files/` の下は DB と同じ相対パスなので、そのままの位置へ写す（docs/unified-archive-design.md §7.4）。
 * DB のコミットの後に呼ぶ前提で、失敗しても投げずに結果へ載せる（DB は既に書けているため）。
 *
 * - 上書き: 既にあるファイルも置き換える
 * - 統合・別で追加: 既にあるファイルは残す
 * - 別で追加: パスに含まれる、振り直した id を新しい id へ書き換える。DB 側の imagePath も
 *   `archiveRowImporter.ts` が同じ `remapArchiveFilePath` で書き換える
 *
 * 展開した `files/` は外から来たものなので信用しない。写す先がデータディレクトリの外に
 * 出るものと、普通のファイルでないもの（シンボリックリンクなど）は写さない。
 */

import * as fs from "fs"
import * as path from "path"

import type { ImportAction } from "../../../../src/types/importAction.types"
import { resolveArchiveFile } from "../../export/unified-archive/archiveFileCollector"
import type { OpenedUnifiedArchive } from "./types"

/** 別で追加で振り直した id（表 → 旧 id → 新 id） */
export type ArchiveIdMap = Readonly<
  Record<string, Readonly<Record<string, string>>>
>

export interface UnifiedArchiveFileImportResult {
  copied: string[]
  replaced: string[]
  skipped: string[]
  failed: { path: string; message: string }[]
}

/** 表ごとの対応を、旧 id → 新 id の1つの表にする（id は uuid で、表をまたいで重ならない） */
export function flattenArchiveIdMap(
  idMap: ArchiveIdMap
): ReadonlyMap<string, string> {
  const newIdByOldId = new Map<string, string>()
  for (const tableIdMap of Object.values(idMap)) {
    for (const [oldId, newId] of Object.entries(tableIdMap)) {
      newIdByOldId.set(oldId, newId)
    }
  }
  return newIdByOldId
}

/**
 * パスの "/" で区切った部分のうち、振り直した旧 id と一致するものを新 id にする。
 * 部分の一部に id を含むだけのもの（`<id>_page1.png` など）は書き換えない
 */
export function remapArchiveFilePath(
  filePath: string,
  newIdByOldId: ReadonlyMap<string, string>
): string {
  if (newIdByOldId.size === 0) return filePath
  return filePath
    .split("/")
    .map((segment) => newIdByOldId.get(segment) ?? segment)
    .join("/")
}

/** `directory` の下の普通のファイルとそれ以外を、"/" 区切りの相対パスで集める */
const listArchiveFiles = (
  directory: string
): { files: string[]; irregular: string[] } => {
  const files: string[] = []
  const irregular: string[] = []
  const walk = (absoluteDirectory: string, relativeSegments: string[]) => {
    for (const entry of fs.readdirSync(absoluteDirectory, {
      withFileTypes: true,
    })) {
      const segments = [...relativeSegments, entry.name]
      if (entry.isDirectory()) {
        walk(path.join(absoluteDirectory, entry.name), segments)
      } else if (entry.isFile()) {
        files.push(segments.join("/"))
      } else {
        irregular.push(segments.join("/"))
      }
    }
  }
  if (fs.existsSync(directory)) walk(directory, [])
  return { files: files.sort(), irregular: irregular.sort() }
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

/**
 * 展開した `files/` の中身を `dataDirectory` へ写す。DB のコミットの後に呼ぶ。
 * 結果のパスは、写した先の（書き換えた後の）相対パス
 */
export function importUnifiedArchiveFiles(
  archive: OpenedUnifiedArchive,
  dataDirectory: string,
  action: ImportAction,
  idMap: ArchiveIdMap
): UnifiedArchiveFileImportResult {
  const result: UnifiedArchiveFileImportResult = {
    copied: [],
    replaced: [],
    skipped: [],
    failed: [],
  }
  const newIdByOldId =
    action === "separate"
      ? flattenArchiveIdMap(idMap)
      : new Map<string, string>()

  const { files, irregular } = listArchiveFiles(archive.filesDirectory)
  for (const irregularPath of irregular) {
    result.failed.push({
      path: irregularPath,
      message: "普通のファイルではないため写しません",
    })
  }

  for (const archivePath of files) {
    const targetPath = remapArchiveFilePath(archivePath, newIdByOldId)
    const resolved = resolveArchiveFile(dataDirectory, targetPath)
    if (resolved.kind === "outsideDataDirectory") {
      result.failed.push({
        path: targetPath,
        message: "データディレクトリの外を指すため写しません",
      })
      continue
    }
    try {
      const exists = fs.existsSync(resolved.absolutePath)
      if (exists && action !== "overwrite") {
        result.skipped.push(targetPath)
        continue
      }
      fs.mkdirSync(path.dirname(resolved.absolutePath), { recursive: true })
      fs.copyFileSync(
        path.join(archive.filesDirectory, ...archivePath.split("/")),
        resolved.absolutePath
      )
      if (exists) result.replaced.push(targetPath)
      else result.copied.push(targetPath)
    } catch (error) {
      result.failed.push({ path: targetPath, message: errorMessage(error) })
    }
  }
  return result
}
