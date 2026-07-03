"use client"

import { useEffect, useRef, useState } from "react"

interface ExcelPreviewScore {
  questionId: string
  questionLabel: string
  score: number | null
  maxScore: number
  status:
    | "unscored"
    | "correct"
    | "partial"
    | "hold"
    | "incorrect"
    | "no_answer"
    | "double_mark"
}

interface ExcelPreviewSubtotalScore {
  subtotalId: string
  subtotalLabel: string
  score: number | null
  maxScore: number
}

export interface ExcelPreviewRow {
  studentId: string
  studentName: string
  studentNumber: string
  grade?: string
  className?: string
  attendanceNumber?: number | null
  status?: "participating" | "expected" | "absent"
  scores: ExcelPreviewScore[]
  totalScore: number | null
  totalMaxScore: number
  subtotalScores: ExcelPreviewSubtotalScore[]
}

export interface ExcelPreviewHeader {
  questionLabels: string[]
  questionMaxScores: number[]
  subtotalLabels: string[]
}

export interface ExcelPreviewData {
  headers: ExcelPreviewHeader
  rows: ExcelPreviewRow[]
}

interface UseExcelPreviewProps {
  examId: string
  selectedStudentIds: string[]
  enabled: boolean
}

/** Excel出力用のプレビューデータ（設問別得点・小計・合計）をデバウンス付きで取得するフック */
export function useExcelPreview({
  examId,
  selectedStudentIds,
  enabled,
}: UseExcelPreviewProps) {
  const [previewData, setPreviewData] = useState<ExcelPreviewData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // selectedStudentIdsのJSON文字列でオブジェクト参照変化を無視
  const selectedStudentIdsKey = JSON.stringify(selectedStudentIds)

  useEffect(() => {
    if (!enabled || !examId || selectedStudentIds.length === 0) {
      setPreviewData(null)
      setError(null)
      setIsLoading(false)
      return
    }

    // デバウンス: 生徒選択変更時に300ms待機
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    setIsLoading(true)

    debounceTimerRef.current = setTimeout(async () => {
      setError(null)

      try {
        const result = await window.electronAPI.export.getExcelPreviewData({
          examId,
          selectedStudentIds,
        })

        if (!result.success || !result.scoringData) {
          setError(result.error || "データの取得に失敗しました")
          setPreviewData(null)
          return
        }

        const headers: ExcelPreviewHeader = {
          questionLabels:
            result.questionRegions?.map(
              (r) => r.label || `問${(r.orderIndex ?? 0) + 1}`
            ) || [],
          questionMaxScores:
            result.questionRegions?.map((r) => r.points ?? 0) || [],
          subtotalLabels:
            result.subtotalColumns?.map(
              (subtotalColumn) => subtotalColumn.label
            ) || [],
        }

        const rows: ExcelPreviewRow[] = result.scoringData.map((data) => ({
          studentId: data.studentId,
          studentName: data.studentName,
          studentNumber: data.studentNumber,
          grade: data.grade,
          className: data.className,
          attendanceNumber: data.attendanceNumber,
          status: data.status,
          scores: data.scores,
          totalScore: data.totalScore,
          totalMaxScore: data.totalMaxScore,
          subtotalScores: data.subtotalScores,
        }))

        setPreviewData({ headers, rows })
      } catch (err) {
        console.error("Excel preview data fetch error:", err)
        setError(
          err instanceof Error ? err.message : "データの取得に失敗しました"
        )
        setPreviewData(null)
      } finally {
        setIsLoading(false)
      }
    }, 300)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId, selectedStudentIdsKey, enabled])

  return { previewData, isLoading, error }
}
