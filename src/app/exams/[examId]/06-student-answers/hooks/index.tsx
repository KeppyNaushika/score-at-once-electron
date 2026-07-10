/**
 * Hooks for 06-student-answers page - quick inline version
 */

import { useCallback, useRef, useState } from "react"
import { toast } from "sonner"

import type { FileState } from "@/components/exams/06-student-answers/student-answer-table/types/dragDropTypes"
import type {
  PendingChange,
  PlacementScorePolicy,
} from "@/components/exams/06-student-answers/types"
import type { ExamPageWithContent } from "@/electron-src/lib/prisma/examPage"
import type {
  ExamStudentWithMemberships,
  StudentAnswerImageWithExamPageAndStudent,
} from "@/types/prismaExtensions"

export function useStudentAnswersData(examId: string) {
  const [students, setStudents] = useState<ExamStudentWithMemberships[]>([])
  const [studentAnswers, setStudentAnswers] = useState<
    StudentAnswerImageWithExamPageAndStudent[]
  >([])
  const [modelAnswerCount, setModelAnswerCount] = useState<number>(0)
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

      // Load students（受験生徒を ExamStudentWithMemberships のまま保持する）
      const examStudentsResult =
        await window.electronAPI.getStudentsForExam(examId)
      if (examStudentsResult.success && examStudentsResult.students) {
        // 受験生徒順の SSOT は ExamStudent.customOrder（05 で定義）。06 は下流の
        // 読み手なので customOrder のみで並べ、出席番号・氏名などの独自フォールバックは
        // 加えない。getStudentsForExam は customOrder 昇順（同着は studentNumber）で返すため、
        // 同着・未設定は安定ソートでその順序を保つ。未設定（null）は末尾へ。
        const sortedStudents = [...examStudentsResult.students].sort(
          (examStudentA, examStudentB) =>
            (examStudentA.customOrder ?? Number.MAX_SAFE_INTEGER) -
            (examStudentB.customOrder ?? Number.MAX_SAFE_INTEGER)
        )

        setStudents(sortedStudents)
      }

      // Load student answers
      const studentAnswersResult =
        await window.electronAPI.getStudentAnswersByExamId(examId)
      if (
        studentAnswersResult.success &&
        studentAnswersResult.studentAnswerImages
      ) {
        // Prisma 型（examPage/student 込み）をそのまま保持する。手写しの中間層は置かない。
        setStudentAnswers(studentAnswersResult.studentAnswerImages)
      }

      // Load model answer count
      try {
        const modelAnswers =
          await window.electronAPI.getExamPagesByExamId(examId)
        const maxPages =
          modelAnswers && modelAnswers.length > 0
            ? Math.max(
                ...modelAnswers.map(
                  (page: ExamPageWithContent) => page.pageNumber
                )
              )
            : 0
        setModelAnswerCount(maxPages)
      } catch (error) {
        console.error("Failed to load model answer count:", error)
        setModelAnswerCount(0)
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
    studentAnswers,
    modelAnswerCount,
    isLoading,
    loadData,
  }
}

export function usePendingChanges(
  onDataReload: () => Promise<void>,
  students?: ExamStudentWithMemberships[],
  studentAnswers?: StudentAnswerImageWithExamPageAndStudent[]
) {
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([])
  const [affectedCells, setAffectedCells] = useState<Set<string>>(new Set())
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)

  const handleUpdatePendingChanges = useCallback(
    (
      changedFiles: Array<{
        fileId: string
        fromState: FileState
        toState: FileState
      }>
    ) => {
      console.log(
        "🔄 Creating pending changes from changed files:",
        changedFiles
      )

      // PendingChange配列を一括作成
      const newPendingChanges = changedFiles.map(
        ({ fileId, fromState, toState }) => {
          // 生徒名を解決
          const fromStudent = students?.find(
            (examStudent) => examStudent.studentId === fromState.studentId
          )
          const toStudent = students?.find(
            (examStudent) => examStudent.studentId === toState.studentId
          )

          // 移動先にある既存ファイルを特定
          // studentAnswersから移動先位置(toState.studentId, toState.pageNumber)にあるファイルを検索
          const targetFile = studentAnswers?.find(
            (sheet) =>
              sheet.studentId === toState.studentId &&
              sheet.examPage.pageNumber === toState.pageNumber &&
              sheet.id !== fileId // 移動されたファイル自体は除外
          )

          console.log("🎯 Target file search:", {
            fileId,
            toState,
            targetFile: targetFile
              ? {
                  id: targetFile.id,
                  studentId: targetFile.studentId,
                  pageNumber: targetFile.examPage.pageNumber,
                }
              : null,
            totalStudentAnswers: studentAnswers?.length || 0,
          })

          const change: PendingChange = {
            id: `${fileId}-change-${Date.now()}-${fromState.studentId}-${fromState.pageNumber}-${toState.studentId}-${toState.pageNumber}`,
            movedFileId: fileId,
            targetFileId: targetFile?.id || null, // 移動先にファイルがない場合はnull
            timestamp: new Date(),
            fromPosition: {
              studentId: fromState.studentId,
              pageNumber: fromState.pageNumber,
              studentName: fromStudent
                ? `${fromStudent.student.lastName} ${fromStudent.student.firstName}`
                : undefined,
            },
            toPosition: {
              studentId: toState.studentId,
              pageNumber: toState.pageNumber,
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
    [students, studentAnswers]
  )

  const handleApplyChanges = useCallback(
    async (policies: Record<string, PlacementScorePolicy>) => {
      try {
        // 各変更を最終位置＋採点方針(carry/discard)付きの move へ。
        // ページ変化の move は carry を受け付けない（バックエンドでもガード）。
        const moves = pendingChanges.map((change) => {
          const pageChanged =
            change.fromPosition.pageNumber !== change.toPosition.pageNumber
          const requested = policies[change.id] ?? "carry"
          const scorePolicy: PlacementScorePolicy = pageChanged
            ? "discard"
            : requested
          return {
            fileId: change.movedFileId,
            finalStudentId: change.toPosition.studentId,
            finalPageNumber: change.toPosition.pageNumber,
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
