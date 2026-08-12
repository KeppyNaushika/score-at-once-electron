/**
 * 生徒アーカイブ エクスポート機能
 *
 * 生徒・学級データをZIPアーカイブとしてエクスポート
 */

import { dialog } from "electron"

import type { ExportStudentsArchiveOptions } from "../../../../src/types/studentArchive.types"
import { recordAuditLog } from "../../prisma/auditLog"
import type { FileExportResult } from "../../shared/types"
import {
  createStudentArchive,
  generateStudentExportFileName,
} from "./archiveCreator"
import { collectStudentArchiveData } from "./dataCollector"

/**
 * 生徒をエクスポートする。
 *
 * 保存先を選ばずに閉じたのは失敗ではないので `canceled` で返す。
 * 書き出しそのものの失敗は例外。
 */
export async function exportStudentsArchive(
  options: ExportStudentsArchiveOptions
): Promise<FileExportResult> {
  const { studentIds, classroomIds } = options

  if (studentIds.length === 0) {
    throw new Error("エクスポートする生徒が選択されていません")
  }

  const collectedData = await collectStudentArchiveData(
    studentIds,
    classroomIds
  )

  const result = await dialog.showSaveDialog({
    title: "生徒データをエクスポート",
    defaultPath: generateStudentExportFileName(),
    filters: [{ name: "生徒データ", extensions: ["students"] }],
  })
  if (result.canceled || !result.filePath) {
    return { canceled: true }
  }

  const archiveResult = await createStudentArchive(
    collectedData,
    result.filePath
  )

  await recordAuditLog({
    action: "student.export",
    entityType: "Student",
    entityId: "student-archive",
    summary: `生徒を${studentIds.length}名エクスポートしました`,
    extra: {
      studentCount: studentIds.length,
      classroomCount: classroomIds?.length ?? 0,
      outputPath: archiveResult.outputPath,
    },
  })

  return { canceled: false, outputPath: archiveResult.outputPath }
}
