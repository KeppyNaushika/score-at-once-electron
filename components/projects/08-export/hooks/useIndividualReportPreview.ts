"use client"

import type { IndividualReportOptions } from "@/app/projects/[projectId]/08-export/types"
import type { IndividualReportData } from "@/electron-src/lib/export/individual-report/types"
import { useCallback, useEffect, useRef, useState } from "react"

interface UseIndividualReportPreviewOptions {
  projectId: string
  selectedStudentIds: string[]
  options: IndividualReportOptions
  enabled?: boolean
}

interface UseIndividualReportPreviewResult {
  previewData: IndividualReportData | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  previewStudentId: string | null
  setPreviewStudentId: (id: string | null) => void
}

/**
 * 個人成績表プレビュー用のフック
 * 選択された生徒の中から1人分のプレビューデータを取得
 * 表示オプションの変更では再取得せず、リアルタイムでプレビューに反映
 */
export function useIndividualReportPreview({
  projectId,
  selectedStudentIds,
  options,
  enabled = true,
}: UseIndividualReportPreviewOptions): UseIndividualReportPreviewResult {
  const [previewData, setPreviewData] = useState<IndividualReportData | null>(
    null
  )
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // プレビュー対象の生徒ID（デフォルトは選択リストの最初）
  const [previewStudentId, setPreviewStudentId] = useState<string | null>(null)

  // optionsの最新値を保持（データ取得時に使用）
  const optionsRef = useRef(options)
  optionsRef.current = options

  // 選択された生徒が変わったらプレビュー対象をリセット
  useEffect(() => {
    if (selectedStudentIds.length > 0) {
      // 現在のプレビュー対象が選択リストにない場合、最初の生徒にリセット
      if (!previewStudentId || !selectedStudentIds.includes(previewStudentId)) {
        setPreviewStudentId(selectedStudentIds[0])
      }
    } else {
      setPreviewStudentId(null)
      setPreviewData(null)
    }
  }, [selectedStudentIds, previewStudentId])

  const fetchPreviewData = useCallback(async () => {
    if (!enabled || !projectId || !previewStudentId) {
      setPreviewData(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await window.electronAPI.export.getIndividualReportData({
        projectId,
        selectedStudentIds: [previewStudentId],
        options: optionsRef.current,
      })

      if (result.success && result.reports && result.reports.length > 0) {
        setPreviewData(result.reports[0])
      } else {
        setError(result.error || "プレビューデータの取得に失敗しました")
        setPreviewData(null)
      }
    } catch (err) {
      console.error("Preview fetch error:", err)
      setError(err instanceof Error ? err.message : "不明なエラー")
      setPreviewData(null)
    } finally {
      setIsLoading(false)
    }
  }, [projectId, previewStudentId, enabled])

  // previewStudentIdが変わったらデータを再取得
  // 注意: subtotalGroupSelectionの変更では再取得しない（レンダラー側でフィルタリング）
  useEffect(() => {
    fetchPreviewData()
  }, [fetchPreviewData])

  return {
    previewData,
    isLoading,
    error,
    refetch: fetchPreviewData,
    previewStudentId,
    setPreviewStudentId,
  }
}
