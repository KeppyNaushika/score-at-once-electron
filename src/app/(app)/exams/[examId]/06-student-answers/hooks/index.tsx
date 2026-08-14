/**
 * Hooks for 06-student-answers page - quick inline version
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"

import type { FileState } from "@/components/exams/06-student-answers/student-answer-table/types"
import type { PendingChange } from "@/components/exams/06-student-answers/types"
import type { PlacementScorePolicy } from "@/electron-src/lib/prisma/studentAnswer/placementApply"
import {
  applyStudentAnswerPlacementsMutation,
  studentAnswersDatasetQuery,
} from "@/queries/answerSheet"
import type {
  StudentAnswerDatasetExamPage,
  StudentAnswerDatasetExamStudent,
} from "@/types/prismaExtensions"

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_EXAM_STUDENTS: StudentAnswerDatasetExamStudent[] = []
const EMPTY_EXAM_PAGES: StudentAnswerDatasetExamPage[] = []

export function useStudentAnswersData(examId: string) {
  const queryClient = useQueryClient()
  // 受験生徒と模範解答ページ（配置済み答案を子に持つ）を Prisma include のまま保持する。
  // 初回だけ全画面スピナー、削除・反映後の取り直しは背後で差し替わる（isPending は
  // キャッシュがある間 false のまま）
  const { data: dataset, isPending: isLoading } = useQuery(
    studentAnswersDatasetQuery(examId)
  )

  const loadData = useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: studentAnswersDatasetQuery(examId).queryKey,
      }),
    [examId, queryClient]
  )

  return {
    students: dataset?.examStudents ?? EMPTY_EXAM_STUDENTS,
    examPages: dataset?.examPages ?? EMPTY_EXAM_PAGES,
    isLoading,
    loadData,
  }
}

export function usePendingChanges(
  examId: string,
  onDataReload: () => Promise<void>,
  students?: StudentAnswerDatasetExamStudent[],
  examPages?: StudentAnswerDatasetExamPage[]
) {
  const applyStudentAnswerPlacements = useMutation(
    applyStudentAnswerPlacementsMutation(examId)
  )
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([])
  const [affectedCells, setAffectedCells] = useState<Set<string>>(new Set())
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)

  // 表示用の pageNumber と、移動先の占有答案検索に使う配置済み答案（いずれもエンティティから導出）
  const pageNumberByExamPageId = useMemo(() => {
    const map = new Map<string, number>()
    for (const examPage of examPages ?? []) {
      map.set(examPage.id, examPage.pageNumber)
    }
    return map
  }, [examPages])
  const placedAnswers = useMemo(
    () => (examPages ?? []).flatMap((examPage) => examPage.studentAnswerImages),
    [examPages]
  )

  const handleUpdatePendingChanges = useCallback(
    (
      changedFiles: Array<{
        fileId: string
        fromState: FileState
        toState: FileState
      }>
    ) => {
      // PendingChange配列を一括作成
      const newPendingChanges = changedFiles.map(
        ({ fileId, fromState, toState }) => {
          // 生徒名を解決（表示用）
          const fromStudent = students?.find(
            (examStudent) => examStudent.id === fromState.examStudentId
          )
          const toStudent = students?.find(
            (examStudent) => examStudent.id === toState.examStudentId
          )

          // 移動先にある既存ファイルを特定（(examStudentId, examPageId) で同定）
          const targetFile = placedAnswers.find(
            (answer) =>
              answer.examStudentId === toState.examStudentId &&
              answer.examPageId === toState.examPageId &&
              answer.id !== fileId // 移動されたファイル自体は除外
          )

          const change: PendingChange = {
            id: `${fileId}-change-${Date.now()}-${fromState.examStudentId}-${fromState.examPageId}-${toState.examStudentId}-${toState.examPageId}`,
            movedFileId: fileId,
            targetFileId: targetFile?.id || null, // 移動先にファイルがない場合はnull
            timestamp: new Date(),
            fromPosition: {
              examStudentId: fromState.examStudentId,
              examPageId: fromState.examPageId ?? "",
              pageNumber: fromState.examPageId
                ? (pageNumberByExamPageId.get(fromState.examPageId) ?? 0)
                : 0,
              studentName: fromStudent
                ? `${fromStudent.student.lastName} ${fromStudent.student.firstName}`
                : undefined,
            },
            toPosition: {
              examStudentId: toState.examStudentId,
              examPageId: toState.examPageId ?? "",
              pageNumber: toState.examPageId
                ? (pageNumberByExamPageId.get(toState.examPageId) ?? 0)
                : 0,
              studentName: toStudent
                ? `${toStudent.student.lastName} ${toStudent.student.firstName}`
                : undefined,
            },
          }
          return change
        }
      )

      // 一括更新
      setPendingChanges(newPendingChanges)
      setAffectedCells(new Set(changedFiles.map(({ fileId }) => fileId)))
    },
    [students, placedAnswers, pageNumberByExamPageId]
  )

  const handleApplyChanges = useCallback(
    async (policies: Record<string, PlacementScorePolicy>) => {
      // 各変更を最終位置（examPageId 直指定）＋採点方針(carry/discard)付きの move へ。
      // ページ変化の move は carry を受け付けない（バックエンドでもガード）。
      const moves = pendingChanges.map((change) => {
        const pageChanged =
          change.fromPosition.examPageId !== change.toPosition.examPageId
        const requested = policies[change.id] ?? "carry"
        const scorePolicy: PlacementScorePolicy = pageChanged
          ? "discard"
          : requested
        return {
          fileId: change.movedFileId,
          finalExamStudentId: change.toPosition.examStudentId,
          finalExamPageId: change.toPosition.examPageId,
          scorePolicy,
        }
      })

      // 失敗はそのまま投げ返す（呼び出し側がモーダルを閉じない）。知らせと
      // DB からの取り直しは中央が行う
      await applyStudentAnswerPlacements.mutateAsync(moves)

      setPendingChanges([])
      setAffectedCells(new Set())

      const discardCount = moves.filter(
        (move) => move.scorePolicy === "discard"
      ).length
      toast.success(
        discardCount > 0
          ? `${moves.length}件を反映しました（採点破棄 ${discardCount}件）`
          : `${moves.length}件を反映しました`
      )
    },
    [pendingChanges, applyStudentAnswerPlacements]
  )

  const handleResetChanges = useCallback(async () => {
    setPendingChanges([])
    setAffectedCells(new Set())
    // リセット = DBから最新データを再読み込み（resetFn不要）
    await onDataReload()
    setIsConfirmModalOpen(false)
    toast.info("変更をリセットしました")
  }, [onDataReload])

  return {
    pendingChanges,
    affectedCells,
    isConfirmModalOpen,
    handleUpdatePendingChanges,
    handleApplyChanges,
    handleResetChanges,
    openConfirmModal: () => setIsConfirmModalOpen(true),
    closeConfirmModal: () => setIsConfirmModalOpen(false),
  }
}
