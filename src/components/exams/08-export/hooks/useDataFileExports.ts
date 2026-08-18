"use client"

import type { Exam } from "@prisma/client"
import { useMutation } from "@tanstack/react-query"
import type { Dispatch, SetStateAction } from "react"
import { toast } from "sonner"

import { generatePrintHtml } from "@/components/exams/08-export/components/individual-report/generatePrintHtml"
import type { StudentExportPlacement } from "@/electron-src/lib/shared/types"
import {
  exportGradingDataExcelMutation,
  exportRDataMutation,
  fetchIndividualReportData,
  openPrintDialogMutation,
} from "@/queries/export"
import type { IndividualReportOptions } from "@/types/individualReport.types"

interface UseDataFileExportsParams {
  exam: Exam | null
  selectedStudents: Set<string>
  individualReportOptions: IndividualReportOptions
  /**
   * 押された瞬間の採番学級を解く。
   *
   * 値ではなく関数で受け取る。取得が済む前に押されると、学年・学級名・出席番号が
   * 既定の所属のもので書かれたファイルが黙って出来上がる。
   */
  resolveStudentPlacements: () => Promise<
    Record<string, StudentExportPlacement>
  >
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
  resolveStudentPlacements,
  setIsExporting,
}: UseDataFileExportsParams) {
  const exportGradingDataExcel = useMutation(exportGradingDataExcelMutation())
  const exportRData = useMutation(exportRDataMutation())
  const openPrintDialog = useMutation(openPrintDialogMutation())

  /** @returns 出力が実際に完了したか（監査ログの記録可否の判断に使う） */
  const executeExportGradingData = async (): Promise<boolean> => {
    if (!exam) return false
    setIsExporting(true)

    try {
      const result = await exportGradingDataExcel.mutateAsync({
        examId: exam.id,
        selectedExamStudentIds: Array.from(selectedStudents),
        studentPlacements: await resolveStudentPlacements(),
      })

      if (result.canceled) return false
      toast.success("採点データExcelを出力しました", {
        description: result.outputPath,
      })
      return true
    } catch {
      // 失敗の通知は MutationCache の後始末が出す
      return false
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportRData = async (format: "csv" | "json") => {
    if (!exam) return
    setIsExporting(true)
    try {
      const result = await exportRData.mutateAsync({
        examId: exam.id,
        selectedExamStudentIds: Array.from(selectedStudents),
        format,
      })
      if (!result.canceled) {
        toast.success(`分析用データを出力しました: ${result.outputPath}`)
      }
    } catch {
      // 失敗の通知は MutationCache の後始末が出す
    } finally {
      setIsExporting(false)
    }
  }

  /** @returns 出力が実際に完了したか（監査ログの記録可否の判断に使う） */
  const executeExportIndividualReports = async (): Promise<boolean> => {
    if (!exam) return false
    setIsExporting(true)

    try {
      // 1. データ取得（統計・アドバイス含む）。読み出しは書き込みではないので
      //    共通の失敗トーストが付かない。ここで自分で知らせる
      let reportData
      try {
        reportData = await fetchIndividualReportData({
          examId: exam.id,
          selectedExamStudentIds: Array.from(selectedStudents),
          options: individualReportOptions,
          studentPlacements: await resolveStudentPlacements(),
        })
      } catch (error) {
        toast.error("個人成績表のデータを取得できませんでした", {
          description: error instanceof Error ? error.message : undefined,
        })
        return false
      }

      // 2. HTMLを生成（プレビューと同じ構造）
      const html = generatePrintHtml(
        reportData.reports,
        reportData.population,
        individualReportOptions
      )

      // 3. 印刷ダイアログを開く（失敗の通知は MutationCache の後始末が出す）
      try {
        await openPrintDialog.mutateAsync({
          html,
          title: `個人成績表 - ${exam.examName}`,
        })
      } catch {
        return false
      }
      return true
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
