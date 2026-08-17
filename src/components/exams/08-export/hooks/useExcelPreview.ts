"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo } from "react"

import type { StudentExportPlacement } from "@/electron-src/lib/shared/types"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { excelPreviewDataQuery } from "@/queries/export"
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

/** 打鍵ごとに重い集計を走らせないための待ち時間（ms） */
const PREVIEW_DEBOUNCE_MS = 300

interface UseExcelPreviewProps {
  examId: string
  /** 呼び出し側で安定した参照を渡すこと（毎レンダー新しい配列だと再取得が止まらない） */
  selectedExamStudentIds: string[]
  /**
   * 採番学級から解いた出力用の学級情報。取得は呼び出し側が持つ。
   * これも安定した参照を渡すこと（読み直しの effect が毎レンダー走る）。
   */
  studentPlacements: Record<string, StudentExportPlacement>
  enabled: boolean
  /**
   * タブへ戻るたびに増える読み直しの合図。出力はデータを読み直すので、
   * プレビューを取得済みのまま据え置くと表示と出力が食い違う。
   */
  reloadKey: number
}

/** Excel出力用のプレビューデータ（設問別得点・小計・合計）をデバウンス付きで取得するフック */
export function useExcelPreview({
  examId,
  selectedExamStudentIds,
  studentPlacements,
  enabled,
  reloadKey,
}: UseExcelPreviewProps) {
  const queryClient = useQueryClient()

  // 生徒選択は連続して変わるので、落ち着いてから取りに行く
  const debouncedExamStudentIds = useDebouncedValue(
    selectedExamStudentIds,
    PREVIEW_DEBOUNCE_MS
  )

  const active = enabled && !!examId && debouncedExamStudentIds.length > 0
  const {
    data: result,
    isFetching,
    error,
  } = useQuery({
    ...excelPreviewDataQuery(
      examId,
      debouncedExamStudentIds,
      studentPlacements
    ),
    enabled: active,
  })

  // 取り直しの行き先。毎レンダー新しい配列になるので、effect の依存に入れる前に畳む
  const queryKey = useMemo(
    () =>
      excelPreviewDataQuery(examId, debouncedExamStudentIds, studentPlacements)
        .queryKey,
    [examId, debouncedExamStudentIds, studentPlacements]
  )

  // タブへ戻ったら読み直す。出力はデータを読むので、据え置くと表示と食い違う
  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey })
  }, [reloadKey, queryKey, queryClient])

  // 表に出す形へ畳むのは計算。キャッシュには main が返した行がそのまま載っている
  const previewData: ExcelPreviewData | null = useMemo(() => {
    if (!result) return null
    return {
      headers: {
        questionLabels: result.questionRegions.map(
          (questionRegion) =>
            questionRegion.label || `問${(questionRegion.orderIndex ?? 0) + 1}`
        ),
        questionMaxScores: result.questionRegions.map(
          (questionRegion) => questionRegion.points ?? 0
        ),
        subtotalLabels: result.subtotalColumns.map(
          (subtotalColumn) => subtotalColumn.label
        ),
      },
      rows: result.scoringData.map((scoringRow) => ({
        examStudentId: scoringRow.examStudentId,
        studentName: scoringRow.studentName,
        studentNumber: scoringRow.studentNumber,
        grade: scoringRow.grade,
        className: scoringRow.className,
        attendanceNumber: scoringRow.attendanceNumber,
        status: scoringRow.status,
        scores: scoringRow.scores,
        totalScore: scoringRow.totalScore,
        totalMaxScore: scoringRow.totalMaxScore,
        subtotalScores: scoringRow.subtotalScores,
      })),
    }
  }, [result])

  return {
    previewData: active ? previewData : null,
    // 失敗しても isFetching は false になる。previewData の有無で見ると
    // 永久に読み込み中のままになり、失敗の理由が画面へ出ない
    isLoading: active && isFetching,
    error: active && error ? error.message : null,
  }
}
