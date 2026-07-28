/**
 * Hooks for 06-student-answers page - quick inline version
 */

import { useCallback, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import type { FileState } from "@/components/exams/06-student-answers/student-answer-table/types"
import type { PendingChange } from "@/components/exams/06-student-answers/types"
import type { PlacementScorePolicy } from "@/electron-src/lib/prisma/studentAnswer/placementApply"
import type {
  ExamStudentWithMemberships,
  StudentAnswerDatasetExamPage,
} from "@/types/prismaExtensions"

export function useStudentAnswersData(examId: string) {
  const [students, setStudents] = useState<ExamStudentWithMemberships[]>([])
  // 列＝ExamPage 実体（配置済み答案を子に持つ）を Prisma include のまま保持する。
  const [examPages, setExamPages] = useState<StudentAnswerDatasetExamPage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  // 初回ロードのみ全画面スピナーを表示する。削除・反映後の再取得は
  // バックグラウンドで差し替え、画面のチラつきを防ぐ。
  const hasLoadedRef = useRef(false)

  const loadData = useCallback(async () => {
    if (!examId) return

    try {
      if (!hasLoadedRef.current) {
        setIsLoading(true)
      }

      // Exam 根の複合 1 クエリ（examStudents + examPages(+answers)）をそのまま保持する。
      const result = await window.electronAPI.getStudentAnswersDataset(examId)
      if (result.success) {
        setStudents(result.examStudents)
        setExamPages(result.examPages)
      } else {
        toast.error(result.error || "データの読み込みに失敗しました")
      }
    } catch (error) {
      console.error("Error loading data:", error)
      toast.error("データの読み込みに失敗しました")
    } finally {
      hasLoadedRef.current = true
      setIsLoading(false)
    }
  }, [examId])

  return {
    students,
    examPages,
    isLoading,
    loadData,
  }
}

export function usePendingChanges(
  onDataReload: () => Promise<void>,
  students?: ExamStudentWithMemberships[],
  examPages?: StudentAnswerDatasetExamPage[]
) {
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
      try {
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

        const result =
          await window.electronAPI.applyStudentAnswerPlacements(moves)

        if (!result || !result.success) {
          throw new Error(result?.error || "配置変更の適用に失敗しました")
        }

        setPendingChanges([])
        setAffectedCells(new Set())
        await onDataReload()

        const discardCount = moves.filter(
          (move) => move.scorePolicy === "discard"
        ).length
        toast.success(
          discardCount > 0
            ? `${moves.length}件を反映しました（採点破棄 ${discardCount}件）`
            : `${moves.length}件を反映しました`
        )
      } catch (error) {
        console.error("変更の適用に失敗しました:", error)

        // エラー時も結局DB再読み込みで解決（resetFn不要）
        await onDataReload()

        toast.error("変更の適用に失敗しました。元の状態に戻しました。")
        throw error
      }
    },
    [pendingChanges, onDataReload]
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
