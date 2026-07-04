/**
 * Hooks for 06-student-answers page - quick inline version
 */

import { useCallback, useRef, useState } from "react"
import { toast } from "sonner"

import type { ProcessedStudentAnswer } from "@/components/exams/06-student-answers/student-answer-management/types"
import type { FileState } from "@/components/exams/06-student-answers/student-answer-table/types/dragDropTypes"
import type {
  PendingChange,
  ScoringDataOption,
} from "@/components/exams/06-student-answers/types"
import type { ExamPageWithDetails } from "@/types/prismaExtensions"
import type { StudentWithMemberships } from "@/types/prismaExtensions"
import type { StudentStatus } from "@/types/studentStatus.types"

import type { StudentData } from "../components"

// APIから返される生徒データの型（StudentWithMembershipsに試験固有フィールドを追加）
interface ExamStudentData extends StudentWithMemberships {
  status: StudentStatus
  customOrder: number | null
}

export function useStudentAnswersData(examId: string) {
  const [students, setStudents] = useState<StudentData[]>([])
  const [studentAnswers, setStudentAnswers] = useState<
    ProcessedStudentAnswer[]
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

      // Load students
      const examStudentsResult =
        await window.electronAPI.getStudentsForExam(examId)
      if (examStudentsResult.success && examStudentsResult.students) {
        const sortedStudents = examStudentsResult.students
          .sort((studentA: ExamStudentData, studentB: ExamStudentData) => {
            if (
              studentA.customOrder !== null &&
              studentA.customOrder !== undefined &&
              studentB.customOrder !== null &&
              studentB.customOrder !== undefined
            ) {
              return studentA.customOrder - studentB.customOrder
            }
            if (
              studentA.customOrder !== null &&
              studentA.customOrder !== undefined
            )
              return -1
            if (
              studentB.customOrder !== null &&
              studentB.customOrder !== undefined
            )
              return 1

            const studentANumber = studentA.memberships?.[0]?.attendanceNumber
            const studentBNumber = studentB.memberships?.[0]?.attendanceNumber
            if (studentANumber && studentBNumber)
              return studentANumber - studentBNumber
            if (studentANumber) return -1
            if (studentBNumber) return 1

            const studentAName = `${studentA.lastName}${studentA.firstName}`
            const studentBName = `${studentB.lastName}${studentB.firstName}`
            return studentAName.localeCompare(studentBName)
          })
          .map((student: ExamStudentData) => ({
            id: student.id,
            lastName: student.lastName,
            firstName: student.firstName,
            lastNameKana: student.lastNameKana,
            firstNameKana: student.firstNameKana,
            studentNumber: student.studentNumber,
            attendanceNumber:
              student.memberships?.[0]?.attendanceNumber || null,
            status: student.status,
            customOrder: student.customOrder ?? null,
          }))

        setStudents(sortedStudents)
      }

      // Load student answers
      const studentAnswersResult =
        await window.electronAPI.getStudentAnswersByExamId(examId)
      if (
        studentAnswersResult.success &&
        studentAnswersResult.studentAnswerImages
      ) {
        // Convert Prisma型をProcessedStudentAnswer型に変換
        const processedAnswers: ProcessedStudentAnswer[] =
          studentAnswersResult.studentAnswerImages.map((img) => ({
            id: img.id,
            studentId: img.studentId,
            pageNumber: img.examPage.pageNumber,
            originalImagePath: img.imagePath,
            isAbsent:
              img.student?.examStudents?.[0]?.status === "ABSENT" || false,
            student: img.student
              ? {
                  id: img.student.id,
                  lastName: img.student.lastName,
                  firstName: img.student.firstName,
                  lastNameKana: img.student.lastNameKana,
                  firstNameKana: img.student.firstNameKana,
                  studentNumber: img.student.studentNumber,
                }
              : null,
            examId: img.examPage.examId,
            status: "ready" as const,
          }))
        setStudentAnswers(processedAnswers)
      }

      // Load model answer count
      try {
        const modelAnswers =
          await window.electronAPI.getExamPagesByExamId(examId)
        const maxPages =
          modelAnswers && modelAnswers.length > 0
            ? Math.max(
                ...modelAnswers.map(
                  (page: ExamPageWithDetails) => page.pageNumber
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
  students?: StudentData[],
  studentAnswers?: ProcessedStudentAnswer[]
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
            (student) => student.id === fromState.studentId
          )
          const toStudent = students?.find(
            (student) => student.id === toState.studentId
          )

          // 移動先にある既存ファイルを特定
          // studentAnswersから移動先位置(toState.studentId, toState.pageNumber)にあるファイルを検索
          const targetFile = studentAnswers?.find(
            (sheet) =>
              sheet.studentId === toState.studentId &&
              sheet.pageNumber === toState.pageNumber &&
              sheet.id !== fileId // 移動されたファイル自体は除外
          )

          console.log("🎯 Target file search:", {
            fileId,
            toState,
            targetFile: targetFile
              ? {
                  id: targetFile.id,
                  studentId: targetFile.studentId,
                  pageNumber: targetFile.pageNumber,
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
                ? `${fromStudent.lastName} ${fromStudent.firstName}`
                : undefined,
            },
            toPosition: {
              studentId: toState.studentId,
              pageNumber: toState.pageNumber,
              studentName: toStudent
                ? `${toStudent.lastName} ${toStudent.firstName}`
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
    async (option: ScoringDataOption) => {
      try {
        // 全ての変更を一方向移動として収集
        const allMoves: Array<{
          fileId: string
          finalStudentId: string | null
          finalPageNumber: number
        }> = []

        for (const change of pendingChanges) {
          // 移動されるファイルの最終位置
          allMoves.push({
            fileId: change.movedFileId,
            finalStudentId: change.toPosition.studentId,
            finalPageNumber: change.toPosition.pageNumber,
          })
        }

        console.log("🔄 Batch moves to apply:", {
          totalMoves: allMoves.length,
          moves: allMoves.map((move) => ({
            fileId: move.fileId.substring(0, 8) + "...",
            to: `${move.finalStudentId?.substring(0, 8) || "null"}...page${move.finalPageNumber}`,
          })),
        })

        // 一括移動処理：トランザクション内で全ての移動を同時実行
        console.log("📝 Calling batch placement update...")
        const result =
          await window.electronAPI.batchUpdateStudentAnswerPlacements(
            allMoves,
            option === "with-scoring"
          )

        console.log("✅ Batch placement update result:", result)

        if (!result || !result.success) {
          throw new Error(result?.error || "一括配置変更に失敗しました")
        }

        console.log("🔄 Clearing pending changes and reloading data...")
        setPendingChanges([])
        setAffectedCells(new Set())

        console.log("🔄 Calling onDataReload...")
        await onDataReload()
        console.log("✅ Data reload completed")

        const optionText =
          option === "with-scoring" ? "採点情報込み" : "答案画像のみ"
        toast.success(
          `${pendingChanges.length}件の変更を適用しました（${optionText}）`
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
