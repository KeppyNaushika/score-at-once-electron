/**
 * 統合アーカイブ（.sao）のファイルをデータディレクトリへ写す
 *
 * `files/` の下は DB と同じ相対パスなので、そのままの位置へ写す（docs/unified-archive-design.md §7.4）。
 * DB のコミットの後に呼ぶ前提で、失敗しても投げずに結果へ載せる（DB は既に書けているため）。
 *
 * - 写すのは、行の取り込みが決めたファイル（`UnifiedArchiveImportResult.filePaths`）だけ。
 *   取り込まなかった行・既存へ寄せて書かなかった行のファイルは写さない（どの行からも参照されず
 *   孤立する）
 * - 作った・置き換えた行のファイル: 上書きは既にあるファイルも置き換え、統合・別で追加は残す
 * - 書かずに残した行のファイル: 取り込み先に無いときだけ写す（行は同じだが画像が欠けている
 *   端末を直す）
 * - パスに含まれる id を、行の取り込みの最終の写し（別で追加の振り直しと、既存の行へ寄せた
 *   写し）で書き換える。DB 側の imagePath も `archiveRowPlanning.ts` が同じ写しと同じ
 *   `remapArchiveFilePath` で書き換えるので、3択に関わらず同じ写しを当てる（写しが空なら何もしない）
 *
 * 展開した `files/` は外から来たものなので信用しない。写す先がデータディレクトリの外に
 * 出るものと、普通のファイルでないもの（シンボリックリンクなど）は写さない。
 */

import * as fs from "fs"
import * as path from "path"

import { resolveArchiveFile } from "../../export/unified-archive/archiveFileCollector"
import type { UnifiedArchiveImportResult } from "./archiveRowImporter"
import type { OpenedUnifiedArchive } from "./types"

/** アーカイブの id と違う id で書いた行（表 → アーカイブの id → 取り込み先の id） */
export type ArchiveIdMap = Readonly<
  Record<string, Readonly<Record<string, string>>>
>

export interface UnifiedArchiveFileImportResult {
  copied: string[]
  replaced: string[]
  /** 取り込み先に既にあるので写さなかった */
  skipped: string[]
  /** 書いた行からも残した行からも参照されないので写さなかった */
  unreferenced: string[]
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
 * 写すのは、行の取り込みが決めたファイル（`imported.filePaths`）だけ。結果のパスは、写した先の
 * （書き換えた後の）相対パス
 */
export function importUnifiedArchiveFiles(
  archive: OpenedUnifiedArchive,
  dataDirectory: string,
  imported: Pick<UnifiedArchiveImportResult, "action" | "idMap" | "filePaths">
): UnifiedArchiveFileImportResult {
  const result: UnifiedArchiveFileImportResult = {
    copied: [],
    replaced: [],
    skipped: [],
    unreferenced: [],
    failed: [],
  }
  const newIdByOldId = flattenArchiveIdMap(imported.idMap)
  const writtenPaths = new Set(imported.filePaths.written)
  const keptPaths = new Set(imported.filePaths.kept)

  const { files, irregular } = listArchiveFiles(archive.filesDirectory)
  for (const irregularPath of irregular) {
    result.failed.push({
      path: irregularPath,
      message: "普通のファイルではないため写しません",
    })
  }

  for (const archivePath of files) {
    const targetPath = remapArchiveFilePath(archivePath, newIdByOldId)
    const written = writtenPaths.has(targetPath)
    if (!written && !keptPaths.has(targetPath)) {
      // 取り込まなかった行・既存へ寄せて書かなかった行のファイル（写すと孤立する）
      result.unreferenced.push(targetPath)
      continue
    }
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
      // 既存のファイルを置き換えるのは、上書きで作った・置き換えた行のものだけ
      if (exists && !(written && imported.action === "overwrite")) {
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
