/**
 * 統合アーカイブ（.sao）に同梱するファイルを集める
 *
 * 書き出した archive.db に残った行が指すファイルだけを、DB と同じ相対パスのまま
 * `files/` の下に置く（docs/unified-archive-design.md §4）。取り込みはパスを組み直さずに済む。
 */

import * as path from "path"

import { UNIFIED_ARCHIVE_FILES_DIR } from "../../../../src/types/unifiedArchive.types"
import type { SqliteDatabase } from "../../prisma/sqliteSchemaUtils"

/**
 * データディレクトリからの相対パスでファイルを指す列。
 *
 * schema.prisma でファイルを指す列はこの5つだけ（模範解答・答案画像・解答用紙定義の
 * セル内画像・AI 採点のプロンプトの問題の画像（旧列と今の表））。名前に path / file / image /
 * url / dir / src を含む String 列を schema から洗うと、この5列と `anchorDirection`
 * （向きの文字列でファイルではない）しか無い。
 * 列を足したらここにも足すこと（表・列の実在は unifiedArchiveRegistry.test.ts が検査する）。
 */
export const ARCHIVE_FILE_COLUMNS = [
  { table: "ExamPage", column: "imagePath" },
  { table: "StudentAnswerImage", column: "imagePath" },
  { table: "AsbImageElement", column: "imagePath" },
  // 旧列（もう書かない）。migration 20261011120000 より前のアーカイブの行が指すファイル
  { table: "AiPrompt", column: "questionImagePath" },
  { table: "AiPromptQuestionImage", column: "imagePath" },
] as const

/** archive.db の行が指すファイルのパスを、重複なく並べて返す */
export function collectArchiveFilePaths(db: SqliteDatabase): string[] {
  const filePaths = new Set<string>()
  for (const fileColumn of ARCHIVE_FILE_COLUMNS) {
    const records = db
      .prepare<[], { filePath: string }>(
        `SELECT DISTINCT "${fileColumn.column}" AS filePath FROM "${fileColumn.table}"
         WHERE "${fileColumn.column}" IS NOT NULL AND "${fileColumn.column}" <> ''`
      )
      .all()
    for (const record of records) filePaths.add(record.filePath)
  }
  return [...filePaths].sort()
}

export type ResolvedArchiveFile =
  | {
      readonly kind: "ok"
      /** 読み出すファイルの絶対パス */
      readonly absolutePath: string
      /** ZIP 内の名前（`files/<"/" 区切りの相対パス>`） */
      readonly zipPath: string
    }
  | { readonly kind: "outsideDataDirectory" }

/**
 * DB に入っているパスを、データディレクトリの中のファイルと ZIP 内の名前に解決する。
 * 絶対パスや `..` でデータディレクトリの外を指すものは同梱しない（外へ渡るファイルに
 * 関係の無いファイルを載せないため）
 */
export function resolveArchiveFile(
  dataDirectory: string,
  relativePath: string
): ResolvedArchiveFile {
  const slashPath = relativePath.replaceAll("\\", "/")
  if (
    path.isAbsolute(relativePath) ||
    path.posix.isAbsolute(slashPath) ||
    /^[A-Za-z]:/.test(slashPath)
  ) {
    return { kind: "outsideDataDirectory" }
  }
  const normalizedPath = path.posix.normalize(slashPath)
  if (
    normalizedPath === "." ||
    normalizedPath === ".." ||
    normalizedPath.startsWith("../")
  ) {
    return { kind: "outsideDataDirectory" }
  }
  const absolutePath = path.join(dataDirectory, ...normalizedPath.split("/"))
  const fromDataDirectory = path.relative(dataDirectory, absolutePath)
  if (
    fromDataDirectory === "" ||
    fromDataDirectory === ".." ||
    fromDataDirectory.startsWith(`..${path.sep}`) ||
    path.isAbsolute(fromDataDirectory)
  ) {
    return { kind: "outsideDataDirectory" }
  }
  return {
    kind: "ok",
    absolutePath,
    zipPath: `${UNIFIED_ARCHIVE_FILES_DIR}/${normalizedPath}`,
  }
}
