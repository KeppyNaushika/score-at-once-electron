"use client"

import { skipToken, useQuery } from "@tanstack/react-query"
import { useEffect, useRef } from "react"

import { loadStudentExportPlacements } from "@/components/exams/08-export/utils/loadStudentExportPlacements"
import type {
  IndividualReportData,
  IndividualReportOptions,
  ReportPopulation,
} from "@/electron-src/lib/export/individual-report/types"
import { queryKeys } from "@/lib/queryKeys"

interface UseIndividualReportPreviewOptions {
  examId: string
  selectedExamStudentIds: string[]
  /** プレビュー対象の生徒。個人成績表と採点済み答案で共通なので呼び出し側が持つ */
  previewStudentId: string | null
  options: IndividualReportOptions
  enabled?: boolean
}

/** プレビュー1枚分と、その統計母集団。母集団は生徒ごとに変わらないので対で持つ */
interface PreviewReport {
  report: IndividualReportData
  population: ReportPopulation
}

interface UseIndividualReportPreviewResult {
  previewReport: PreviewReport | null
  isLoading: boolean
  error: string | null
}

/**
 * 個人成績表プレビュー用のフック
 * 選択された生徒の中から1人分のプレビューデータを取得
 * 表示オプションの変更では再取得せず、リアルタイムでプレビューに反映
 */
export function useIndividualReportPreview({
  examId,
  previewStudentId,
  options,
  enabled = true,
}: UseIndividualReportPreviewOptions): UseIndividualReportPreviewResult {
  /**
   * 表示オプションは取得の引数だが、**変わっても取り直さない**
   * （小計点グループの選択などは renderer 側でフィルタするため）。
   * 取得時に最新を読むだけなので ref で持つ（クエリキーには入れない）。
   */
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  })

  const {
    data: previewReport = null,
    isPending,
    error,
  } = useQuery({
    // 取り直すのは対象生徒が変わったときだけ
    queryKey: queryKeys.exam.individualReportPreview(
      examId,
      previewStudentId ?? ""
    ),
    queryFn:
      enabled && examId && previewStudentId
        ? async (): Promise<PreviewReport> => {
            const studentPlacements = await loadStudentExportPlacements(examId)
            const result =
              await window.electronAPI.export.getIndividualReportData({
                examId,
                selectedExamStudentIds: [previewStudentId],
                options: optionsRef.current,
                studentPlacements,
              })
            if (result.reports.length === 0) {
              throw new Error("プレビュー対象の生徒が見つかりませんでした")
            }
            return {
              report: result.reports[0],
              population: result.population,
            }
          }
        : skipToken,
  })

  return {
    previewReport,
    // 対象生徒が無いときは待たせない
    isLoading: Boolean(enabled && previewStudentId) && isPending,
    error: error?.message ?? null,
  }
}
