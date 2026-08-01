"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { loadStudentExportPlacements } from "@/components/exams/08-export/utils/loadStudentExportPlacements"
import type {
  IndividualReportData,
  IndividualReportOptions,
  ReportPopulation,
} from "@/electron-src/lib/export/individual-report/types"

interface UseIndividualReportPreviewOptions {
  examId: string
  selectedExamStudentIds: string[]
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
  previewStudentId: string | null
  setPreviewStudentId: (id: string | null) => void
}

/**
 * 個人成績表プレビュー用のフック
 * 選択された生徒の中から1人分のプレビューデータを取得
 * 表示オプションの変更では再取得せず、リアルタイムでプレビューに反映
 */
export function useIndividualReportPreview({
  examId,
  selectedExamStudentIds,
  options,
  enabled = true,
}: UseIndividualReportPreviewOptions): UseIndividualReportPreviewResult {
  const [previewReport, setPreviewReport] = useState<PreviewReport | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // プレビュー対象の生徒ID（デフォルトは選択リストの最初）
  const [previewStudentId, setPreviewStudentId] = useState<string | null>(null)

  // optionsの最新値を保持（データ取得時に使用）
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  })

  // 選択された生徒が変わったらプレビュー対象をリセット
  useEffect(() => {
    if (selectedExamStudentIds.length > 0) {
      // 現在のプレビュー対象が選択リストにない場合、最初の生徒にリセット
      if (
        !previewStudentId ||
        !selectedExamStudentIds.includes(previewStudentId)
      ) {
        setPreviewStudentId(selectedExamStudentIds[0])
      }
    } else {
      setPreviewStudentId(null)
      setPreviewReport(null)
    }
  }, [selectedExamStudentIds, previewStudentId])

  const fetchPreviewData = useCallback(async () => {
    if (!enabled || !examId || !previewStudentId) {
      setPreviewReport(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const studentPlacements = await loadStudentExportPlacements(examId)
      const result = await window.electronAPI.export.getIndividualReportData({
        examId,
        selectedExamStudentIds: [previewStudentId],
        options: optionsRef.current,
        studentPlacements,
      })

      if (result.success && result.reports?.length && result.population) {
        setPreviewReport({
          report: result.reports[0],
          population: result.population,
        })
      } else {
        setError(result.error || "プレビューデータの取得に失敗しました")
        setPreviewReport(null)
      }
    } catch (err) {
      console.error("Preview fetch error:", err)
      setError(err instanceof Error ? err.message : "不明なエラー")
      setPreviewReport(null)
    } finally {
      setIsLoading(false)
    }
  }, [examId, previewStudentId, enabled])

  // previewStudentIdが変わったらデータを再取得
  // 注意: subtotalGroupSelectionの変更では再取得しない（レンダラー側でフィルタリング）
  useEffect(() => {
    fetchPreviewData()
  }, [fetchPreviewData])

  return {
    previewReport,
    isLoading,
    error,
    previewStudentId,
    setPreviewStudentId,
  }
}
