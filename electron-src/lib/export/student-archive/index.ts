/**
 * 生徒アーカイブ エクスポート機能
 *
 * 生徒・学級データをZIPアーカイブとしてエクスポート
 */

import { dialog } from "electron"

import type {
  ExportStudentsArchiveOptions,
  ExportStudentsArchiveResult,
} from "../../../../src/types/studentArchive.types"
import { recordAuditLog } from "../../prisma/auditLog"
import {
  createStudentArchive,
  generateStudentExportFileName,
} from "./archiveCreator"
import { collectStudentArchiveData } from "./dataCollector"

/**
 * 生徒をエクスポート
 */
export async function exportStudentsArchive(
  options: ExportStudentsArchiveOptions
): Promise<ExportStudentsArchiveResult> {
  const { studentIds, classroomIds } = options

  try {
    if (studentIds.length === 0) {
      return {
        success: false,
        error: "エクスポートする生徒が選択されていません",
      }
    }

    // 1. データを収集
    const collectedData = await collectStudentArchiveData(
      studentIds,
      classroomIds
    )

    // 2. 保存先ダイアログを表示
    const defaultFileName = generateStudentExportFileName()
    const result = await dialog.showSaveDialog({
      title: "生徒データをエクスポート",
      defaultPath: defaultFileName,
      filters: [{ name: "生徒データ", extensions: ["students"] }],
    })

    if (result.canceled || !result.filePath) {
      return { success: false, error: "キャンセルされました" }
    }

    // 3. アーカイブを作成
    const archiveResult = await createStudentArchive(
      collectedData,
      result.filePath
    )

    if (!archiveResult.success) {
      return { success: false, error: archiveResult.error }
    }

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

    return {
      success: true,
      outputPath: archiveResult.outputPath,
      manifest: archiveResult.manifest,
    }
  } catch (error) {
    console.error("Error exporting students archive:", error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "エクスポートに失敗しました",
    }
  }
}
