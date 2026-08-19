/**
 * 試験アーカイブ エクスポート機能
 *
 * 試験の全データと画像をZIPアーカイブとしてエクスポート
 */

import { dialog } from "electron"

import type { ExportExamOptions } from "../../../../src/types/examArchive.types"
import { recordAuditLog } from "../../prisma/auditLog"
import { getExamById } from "../../prisma/exam"
import type { FileExportResult } from "../../shared/types"
import { createArchive, generateExportFileName } from "./archiveCreator"
import { collectExamData } from "./dataCollector"

/**
 * 出力先が決まっている試験のエクスポート。
 *
 * 失敗は例外で伝える。一括書き出しは試験ごとの成否を集計するので、
 * 保存ダイアログを挟まないこちらを直接呼ぶ。
 */
export async function exportExamTo(
  options: ExportExamOptions & { outputPath: string }
): Promise<{ outputPath: string; missingFiles: string[] }> {
  const { examId, userId, outputPath, exportMode = "full" } = options

  const exam = await getExamById(examId)
  if (!exam) {
    throw new Error("試験が見つかりません")
  }

  // ログインユーザーのデータのみ、モードに応じて部分収集
  const collectResult = await collectExamData(examId, userId, exportMode)
  if (!collectResult.success || !collectResult.data) {
    throw new Error(collectResult.error ?? "データの収集に失敗しました")
  }

  const archiveResult = await createArchive({
    collectedData: collectResult.data,
    examName: exam.examName,
    examId,
    outputPath,
    exportMode,
  })

  // 監査ログ: 試験エクスポート（操作者は認証ストアから自動補完。userIdは対象データの絞り込み用）
  await recordAuditLog({
    action: "exam.export",
    entityType: "Exam",
    entityId: examId,
    scopeId: examId,
    scopeLabel: exam.examName,
    target: exam.examName,
    extra: {
      exportMode,
      outputPath: archiveResult.outputPath,
      // 欠けたまま書き出したなら、記録にも残す（成功としてだけ残さない）
      ...(archiveResult.missingFiles.length > 0 && {
        missingFiles: archiveResult.missingFiles,
      }),
    },
  })

  return {
    outputPath: archiveResult.outputPath,
    missingFiles: archiveResult.missingFiles,
  }
}

/**
 * 保存先を尋ねてから試験をエクスポートする。
 *
 * 選ばずに閉じたのは失敗ではないので `canceled` で返す。
 */
export async function exportExam(
  options: ExportExamOptions
): Promise<FileExportResult> {
  const { examId, exportMode = "full" } = options

  const exam = await getExamById(examId)
  if (!exam) {
    throw new Error("試験が見つかりません")
  }

  const result = await dialog.showSaveDialog({
    title: "試験をエクスポート",
    defaultPath: generateExportFileName(exam.examName, exportMode),
    filters: [{ name: "一括採点試験データ", extensions: ["score"] }],
  })
  if (result.canceled || !result.filePath) {
    return { canceled: true }
  }

  const { outputPath, missingFiles } = await exportExamTo({
    ...options,
    outputPath: result.filePath,
  })
  return { canceled: false, outputPath, missingFiles }
}
