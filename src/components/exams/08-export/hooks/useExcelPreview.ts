"use client"

import { useEffect, useState } from "react"

import { loadStudentExportPlacements } from "@/components/exams/08-export/utils/loadStudentExportPlacements"
import type { ExamStudentStatus } from "@/types/examStudentStatus.types"
import type { ScoringStatus } from "@/types/scoringStatus.types"

interface ExcelPreviewScore {
  questionId: string
  questionLabel: string
  score: number | null
  maxScore: number
  status: ScoringStatus
}

interface ExcelPreviewSubtotalScore {
  subtotalId: string
  subtotalLabel: string
  score: number | null
  maxScore: number
}

export interface ExcelPreviewRow {
  examStudentId: string
  studentName: string
  studentNumber: string
  grade?: string
  className?: string
  attendanceNumber?: number | null
  status?: ExamStudentStatus
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
  /** 呼び出し側で安定した参照を渡すこと（毎レンダー新しい配列だと再取得が止まらない） */
  selectedExamStudentIds: string[]
  enabled: boolean
  /**
   * タブへ戻るたびに増える読み直しの合図。出力は実データを読み直すので、
   * プレビューを取得済みのまま据え置くと表示と出力が食い違う。
   */
  reloadKey: number
}

/** Excel出力用のプレビューデータ（設問別得点・小計・合計）をデバウンス付きで取得するフック */
export function useExcelPreview({
  examId,
  selectedExamStudentIds,
  enabled,
  reloadKey,
}: UseExcelPreviewProps) {
  // 取得結果は「どの試験・どの生徒選択に対するものか」を一緒に持つ。入力が
  // 変われば一致しなくなるので、読み込み中フラグや消去の effect が要らない
  const [fetched, setFetched] = useState<{
    examId: string
    selectedExamStudentIds: string[]
    reloadKey: number
    previewData: ExcelPreviewData | null
    error: string | null
  } | null>(null)

  const active = enabled && !!examId && selectedExamStudentIds.length > 0
  const isCurrent =
    fetched?.examId === examId &&
    fetched.selectedExamStudentIds === selectedExamStudentIds &&
    fetched.reloadKey === reloadKey

  const previewData = active && isCurrent ? fetched.previewData : null
  const error = active && isCurrent ? fetched.error : null
  const isLoading = active && !isCurrent

  useEffect(() => {
    if (!active || isCurrent) return

    // デバウンス: 生徒選択変更時に300ms待機
    const timer = setTimeout(async () => {
      try {
        const studentPlacements = await loadStudentExportPlacements(examId)
        const result = await window.electronAPI.export.getExcelPreviewData({
          examId,
          selectedExamStudentIds,
          studentPlacements,
        })

        if (!result.success || !result.scoringData) {
          setFetched({
            examId,
            selectedExamStudentIds,
            reloadKey,
            previewData: null,
            error: result.error || "データの取得に失敗しました",
          })
          return
        }

        const headers: ExcelPreviewHeader = {
          questionLabels:
            result.questionRegions?.map(
              (questionRegion) =>
                questionRegion.label ||
                `問${(questionRegion.orderIndex ?? 0) + 1}`
            ) || [],
          questionMaxScores:
            result.questionRegions?.map(
              (questionRegion) => questionRegion.points ?? 0
            ) || [],
          subtotalLabels:
            result.subtotalColumns?.map(
              (subtotalColumn) => subtotalColumn.label
            ) || [],
        }

        const rows: ExcelPreviewRow[] = result.scoringData.map((data) => ({
          examStudentId: data.examStudentId,
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

        setFetched({
          examId,
          selectedExamStudentIds,
          reloadKey,
          previewData: { headers, rows },
          error: null,
        })
      } catch (err) {
        console.error("Excel preview data fetch error:", err)
        setFetched({
          examId,
          selectedExamStudentIds,
          reloadKey,
          previewData: null,
          error:
            err instanceof Error ? err.message : "データの取得に失敗しました",
        })
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [active, isCurrent, examId, selectedExamStudentIds, reloadKey])

  return { previewData, isLoading, error }
}
