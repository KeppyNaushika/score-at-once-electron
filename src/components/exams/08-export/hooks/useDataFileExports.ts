"use client"

import type { Exam } from "@prisma/client"
import type { Dispatch, SetStateAction } from "react"
import { toast } from "sonner"

import { generatePrintHtml } from "@/components/exams/08-export/components/individual-report/generatePrintHtml"
import { loadStudentExportPlacements } from "@/components/exams/08-export/utils/loadStudentExportPlacements"
import type { IndividualReportOptions } from "@/electron-src/lib/export/individual-report/types"

interface UseDataFileExportsParams {
  exam: Exam | null
  selectedStudents: Set<string>
  individualReportOptions: IndividualReportOptions
  setIsExporting: Dispatch<SetStateAction<boolean>>
}

/**
 * Canvas 描画を伴わないファイル出力（採点データ Excel・分析用 R データ・個人成績表の印刷）を
 * 管理するフック。バリデーションや警告モーダルの制御は呼び出し側（ExportMainView）が担い、
 * 本フックはバリデーション通過後に実行される出力処理（execute 系）と、バリデーション不要の
 * R データ出力を提供する。
 */
export function useDataFileExports({
  exam,
  selectedStudents,
  individualReportOptions,
  setIsExporting,
}: UseDataFileExportsParams) {
  /** @returns 出力が実際に完了したか（監査ログの記録可否の判断に使う） */
  const executeExportGradingData = async (): Promise<boolean> => {
    if (!exam) return false
    setIsExporting(true)

    try {
      const selectedExamStudentIds = Array.from(selectedStudents)
      const studentPlacements = await loadStudentExportPlacements(exam.id)

      const result = await window.electronAPI.exportGradingDataExcel({
        examId: exam.id,
        selectedExamStudentIds,
        forceExport: true,
        studentPlacements,
      })

      if (result.success) {
        alert(
          `採点データExcelの出力が完了しました。\n保存先: ${result.outputPath}`
        )
        return true
      }
      alert(`出力に失敗しました: ${result.error}`)
      return false
    } catch (error) {
      console.error("Export error:", error)
      alert("出力中にエラーが発生しました")
      return false
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportRData = async (format: "csv" | "json") => {
    if (!exam) return
    setIsExporting(true)
    try {
      const selectedExamStudentIds = Array.from(selectedStudents)
      const result = await window.electronAPI.exportRData({
        examId: exam.id,
        selectedExamStudentIds,
        format,
      })
      if (result.success) {
        toast.success(`分析用データを出力しました: ${result.outputPath}`)
      } else if (result.error !== "出力がキャンセルされました") {
        toast.error(`出力に失敗しました: ${result.error ?? ""}`)
      }
    } catch (error) {
      console.error("R data export error:", error)
      toast.error("出力中にエラーが発生しました")
    } finally {
      setIsExporting(false)
    }
  }

  /** @returns 出力が実際に完了したか（監査ログの記録可否の判断に使う） */
  const executeExportIndividualReports = async (): Promise<boolean> => {
    if (!exam) return false
    setIsExporting(true)

    try {
      const selectedExamStudentIds = Array.from(selectedStudents)
      const studentPlacements = await loadStudentExportPlacements(exam.id)

      // 1. データ取得（統計・アドバイス含む）
      const dataResult =
        await window.electronAPI.export.getIndividualReportData({
          examId: exam.id,
          selectedExamStudentIds,
          options: individualReportOptions,
          studentPlacements,
        })

      if (!dataResult.success || !dataResult.reports) {
        throw new Error(dataResult.error || "データ取得に失敗しました")
      }

      // 2. HTMLを生成（プレビューと同じ構造）
      const html = generatePrintHtml(
        dataResult.reports,
        individualReportOptions
      )

      // 3. 印刷ダイアログを開く
      const result = await window.electronAPI.export.openPrintDialog({
        html,
        title: `個人成績表 - ${exam?.examName || ""}`,
      })

      if (!result.success) {
        throw new Error(result.error || "印刷ダイアログを開けませんでした")
      }
      return true
    } catch (error) {
      console.error("Individual report export error:", error)
      alert(
        `エラー: ${error instanceof Error ? error.message : "不明なエラー"}`
      )
      return false
    } finally {
      setIsExporting(false)
    }
  }

  return {
    executeExportGradingData,
    handleExportRData,
    executeExportIndividualReports,
  }
}
