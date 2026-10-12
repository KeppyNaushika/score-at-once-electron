import { dialog } from "electron"

import type { ConflictWarning } from "@/types/exportValidation.types"
import type { GetIndividualReportDataOptions } from "@/types/individualReport.types"

import { fetchExportData } from "../lib/export/excel/dataFetcher"
import { exportGradingDataExcel } from "../lib/export/excel/excelExportMain"
import {
  fetchIndividualReportData,
  fetchSubtotalGroupsForReport,
} from "../lib/export/individual-report/dataFetcher"
import {
  exportRData,
  type ExportRDataOptions,
} from "../lib/export/r-exametrika/rDataExporter"
import {
  type HtmlPrintPreviewOptions,
  type HtmlToPdfFileOptions,
  openHtmlPrintPreview,
  printHtmlToPdfFile,
} from "../lib/printUtils"
import { recordAuditLog } from "../lib/prisma/auditLog"
import { resolveExamScope } from "../lib/prisma/auditScope"
import {
  addPageToStreamingSession,
  cancelStreamingSession,
  createPdfStreamingSession,
  finalizeStreamingSession,
  getPdfExportData,
} from "../lib/prisma/pdfExport"
import {
  captureReturnSnapshot,
  getReturnDiff,
} from "../lib/prisma/returnSnapshot"
import { getExamDecisionSummary } from "../lib/prisma/scoreDecisionSummary"
import type { StudentExportPlacement } from "../lib/shared/types"
import {
  buildConflictWarnings,
  validateScoringData,
} from "../lib/shared/utilities/validateScoringData"
import { type HandlerMap } from "./ipcHandlerUtils"

/** Excel・PDF出力・個人成績表・ストリーミングPDF生成に関するIPCチャンネルを登録する */
export const exportHandlers = {
  // 採点データバリデーション（全エクスポート共通）
  "export:validateScoringData": async (options: {
    examId: string
    selectedExamStudentIds: string[]
    userId: string
  }) => {
    const exportData = await fetchExportData(
      options.examId,
      options.selectedExamStudentIds
    )

    // 食い違いの内訳（採点者ごとの判定・点数影響）は裁定サマリから供給する。
    // 確定パネルと同じ計算を通すことで、警告と裁定画面の件数がずれない。
    //
    // 裁定サマリだけが落ちても出力は止めない（止めずに伝える）。ただし検査できな
    // かったことを空配列＝食い違いなしへ化けさせず、結果に載せて画面へ出す。
    let conflictWarnings: ConflictWarning[] = []
    let conflictCheckError: string | undefined
    try {
      const decisionSummary = await getExamDecisionSummary(
        options.examId,
        options.userId
      )
      conflictWarnings = buildConflictWarnings(
        decisionSummary,
        options.selectedExamStudentIds
      )
    } catch (error) {
      conflictCheckError =
        error instanceof Error
          ? error.message
          : "採点者間の食い違いを検査できませんでした"
    }

    return validateScoringData(
      exportData.scoringData,
      conflictWarnings,
      conflictCheckError
    )
  },

  // 未解決の食い違いを含んだまま出力したことを監査ログに残す。
  // 出力そのものは止めない（配布物も汚さない）が、後から辿れるようにする。
  "export:recordUnresolvedConflicts": async (options: {
    examId: string
    userId: string
    exportType: string
    conflicts: Array<{ studentName: string; questionLabel: string }>
    scoreImpact: number
  }) => {
    const scope = await resolveExamScope(options.examId)
    await recordAuditLog({
      action: "exam.score.export_unresolved",
      userId: options.userId,
      entityType: "Exam",
      entityId: options.examId,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
      summary: `未解決の食い違い${options.conflicts.length}件を含む採点結果を出力しました（合計点が最大${options.scoreImpact}点低く出ます）`,
      extra: {
        exportType: options.exportType,
        conflicts: options.conflicts.map(
          (conflict) => `${conflict.studentName} - ${conflict.questionLabel}`
        ),
      },
    })
  },

  // Excel Export handlers
  "export-grading-data-excel": async (options: {
    examId: string
    selectedExamStudentIds: string[]
    outputPath?: string
    studentPlacements?: Record<string, StudentExportPlacement>
  }) => {
    return await exportGradingDataExcel(options)
  },

  // R / exametrika 向けデータ出力（#834）
  "export-r-data": async (options: ExportRDataOptions) => {
    return await exportRData(options)
  },

  // Excelプレビュー用データ取得
  "export:getExcelPreviewData": async (options: {
    examId: string
    selectedExamStudentIds: string[]
    studentPlacements?: Record<string, StudentExportPlacement>
  }) => {
    const exportData = await fetchExportData(
      options.examId,
      options.selectedExamStudentIds,
      options.studentPlacements
    )
    // Prismaの Decimal/Date 型はIPC経由でcloneできないため、
    // プレーンなJSオブジェクトに変換して返す
    const questionRegions = exportData.questionRegions.map(
      (questionRegion) => ({
        id: questionRegion.id,
        label: questionRegion.label,
        points:
          questionRegion.points != null ? Number(questionRegion.points) : null,
        orderIndex:
          questionRegion.orderIndex != null
            ? Number(questionRegion.orderIndex)
            : null,
      })
    )

    const scoringData = exportData.scoringData.map((studentScoring) => ({
      examStudentId: studentScoring.examStudentId,
      studentName: studentScoring.studentName,
      studentNumber: studentScoring.studentNumber,
      grade: studentScoring.grade,
      className: studentScoring.className,
      attendanceNumber:
        studentScoring.attendanceNumber != null
          ? Number(studentScoring.attendanceNumber)
          : null,
      status: studentScoring.status,
      scores: studentScoring.scores.map((score) => ({
        questionId: score.questionId,
        questionLabel: score.questionLabel,
        score: score.score != null ? Number(score.score) : null,
        maxScore: Number(score.maxScore),
        status: score.status,
      })),
      totalScore:
        studentScoring.totalScore != null
          ? Number(studentScoring.totalScore)
          : null,
      totalMaxScore: Number(studentScoring.totalMaxScore),
      subtotalScores: studentScoring.subtotalScores.map((subtotalScore) => ({
        subtotalId: subtotalScore.subtotalId,
        subtotalLabel: subtotalScore.subtotalLabel,
        score: subtotalScore.score != null ? Number(subtotalScore.score) : null,
        maxScore: Number(subtotalScore.maxScore),
      })),
    }))

    return {
      questionRegions,
      subtotalColumns: exportData.subtotalColumns,
      scoringData,
    }
  },

  // Canvas描画用PDF出力データ取得
  "export:getPdfExportData": async (options: {
    examId: string
    selectedExamStudentIds: string[]
  }) => {
    return await getPdfExportData(options)
  },

  // PDF保存先選択ダイアログ（Canvas描画前に呼び出す）
  "export:selectPdfSavePath": async (options: {
    examName?: string
  }): Promise<{ canceled: true } | { canceled: false; filePath: string }> => {
    const dateStr = new Date().toISOString().split("T")[0]
    const safeExamName = options.examName
      ? options.examName.replace(/[<>:"/\\|?*]/g, "_")
      : null
    const defaultFileName = safeExamName
      ? `採点済み答案_${safeExamName}_${dateStr}.pdf`
      : `採点済み答案_${dateStr}.pdf`

    const result = await dialog.showSaveDialog({
      title: "採点済み答案PDFの保存先",
      defaultPath: defaultFileName,
      filters: [{ name: "PDF Files", extensions: ["pdf"] }],
    })

    if (result.canceled || !result.filePath) {
      return { canceled: true }
    }

    return { canceled: false, filePath: result.filePath }
  },

  // ============================================================
  // ストリーミングPDF生成API
  // ============================================================

  // ストリーミングセッション作成
  "export:createPdfStreamingSession": async (options: {
    totalPages: number
    pdfOrientation?: "portrait" | "landscape"
  }) => {
    return await createPdfStreamingSession(options)
  },

  // ストリーミングセッションにページを追加
  "export:addPageToStreamingSession": async (options: {
    sessionId: string
    pageIndex: number
    imageData: ArrayBuffer
  }) => {
    return await addPageToStreamingSession(options)
  },

  // ストリーミングセッションを完了してPDF保存
  "export:finalizeStreamingSession": async (options: {
    sessionId: string
    outputPath: string
  }) => {
    return await finalizeStreamingSession(options)
  },

  // ストリーミングセッションをキャンセル
  "export:cancelStreamingSession": async (sessionId: string) => {
    cancelStreamingSession(sessionId)
  },

  // ============================================================
  // 個人成績表PDF API
  // ============================================================

  // 個人成績表用データ取得
  "export:getIndividualReportData": async (
    options: GetIndividualReportDataOptions
  ) => {
    return await fetchIndividualReportData(options)
  },

  // 個人成績表用小計点グループ一覧取得
  "export:getSubtotalGroupsForReport": async (examId: string) => {
    return await fetchSubtotalGroupsForReport(examId)
  },

  // HTMLからPDFを生成（ブラウザ印刷機能を使用）
  "export:printHtmlToPdf": async (options: HtmlToPdfFileOptions) =>
    printHtmlToPdfFile(options),

  // HTMLからPDFを生成してプレビューで開く（web 版は印刷ダイアログを出す）
  "export:openPrintDialog": async (options: HtmlPrintPreviewOptions) =>
    openHtmlPrintPreview(options),

  // 答案返却スナップショット: 現在の有効スコア＋注釈を返却版として記録する
  "export:captureReturnSnapshot": async (options: {
    examId: string
    examStudentIds: string[]
  }) => {
    return await captureReturnSnapshot({
      examId: options.examId,
      examStudentIds: options.examStudentIds,
    })
  },

  // 返却版と現在状態の差分（変更があった生徒の検出）
  "export:getReturnDiff": async (examId: string) => {
    return await getReturnDiff(examId)
  },
} satisfies HandlerMap
