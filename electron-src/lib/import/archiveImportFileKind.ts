import AdmZip from "adm-zip"
import * as path from "path"

import {
  ARCHIVE_IMPORT_FILE_KINDS,
  type ArchiveImportFileKind,
} from "../../../src/types/archiveImportFile.types"

/** リアテンダント™の .dat（ZIP）が必ず持つファイル */
const REALTENDANT_VERSION_ENTRY = "RealtendantAppVersion.txt"

/**
 * .dat がリアテンダント™の形式か。ZIP として開けない・目印が無ければ違う
 * （旧の試験の取り込みは、そのとき .score として読みに行って失敗を見せていた）
 */
const isRealtendantDat = (filePath: string): boolean => {
  try {
    return new AdmZip(filePath)
      .getEntries()
      .some((entry) => entry.entryName.endsWith(REALTENDANT_VERSION_ENTRY))
  } catch {
    return false
  }
}

/**
 * 「読み込み」で選ばれたファイルの種類を拡張子で決める（大文字小文字は区別しない）。
 * 知らない拡張子なら null
 */
export const archiveImportFileKindOf = (
  filePath: string
): ArchiveImportFileKind | null => {
  const extension = path.extname(filePath).slice(1).toLowerCase()
  const kind =
    ARCHIVE_IMPORT_FILE_KINDS.find(
      (candidateKind) => candidateKind === extension
    ) ?? null
  if (kind === "dat" && !isRealtendantDat(filePath)) return "score"
  return kind
}
