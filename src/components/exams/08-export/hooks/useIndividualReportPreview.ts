"use client"

import { useQuery } from "@tanstack/react-query"

import type { StudentExportPlacement } from "@/electron-src/lib/shared/types"
import { individualReportPreviewQuery } from "@/queries/export"
import type {
  IndividualReportData,
  IndividualReportOptions,
  ReportPopulation,
} from "@/types/individualReport.types"

interface UseIndividualReportPreviewOptions {
  examId: string
  /** プレビュー対象の生徒。個人成績表と採点済み答案で共通なので呼び出し側が持つ */
  previewStudentId: string | null
  options: IndividualReportOptions
  /** 採番学級から解いた出力用の学級情報。取得は呼び出し側が持つ */
  studentPlacements: Record<string, StudentExportPlacement>
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
 * 個人成績表プレビュー用のフック。
 *
 * 表示オプションは取得の引数だが**変わっても取り直さない**（小計点グループの
 * 選択などは renderer 側で絞り込むため）。キーに入れていないので、次に取りに
 * 行くときだけ最新が使われる。
 */
export function useIndividualReportPreview({
  examId,
  previewStudentId,
  options,
  studentPlacements,
  enabled = true,
}: UseIndividualReportPreviewOptions): UseIndividualReportPreviewResult {
  const {
    data: reportData,
    isPending,
    error,
  } = useQuery({
    ...individualReportPreviewQuery(
      examId,
      previewStudentId ?? "",
      options,
      studentPlacements
    ),
    enabled: enabled && Boolean(examId) && Boolean(previewStudentId),
  })

  // 1人ぶんだけ頼んでいるので、返ってくるのも1件。畳むのは取得ではなく計算
  const firstReport = reportData?.reports[0]

  return {
    previewReport:
      reportData && firstReport
        ? { report: firstReport, population: reportData.population }
        : null,
    // 対象生徒が無いときは待たせない
    isLoading: Boolean(enabled && previewStudentId) && isPending,
    error:
      error?.message ??
      (reportData && !firstReport
        ? "プレビュー対象の生徒が見つかりませんでした"
        : null),
  }
}
