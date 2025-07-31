/**
 * Hooks for 06-answer-sheets page - quick inline version
 */

import type {
  PendingChange,
  ScoringDataOption,
} from "@/types/answer-sheet.types"
import type { ProcessedAnswerSheet } from "@/components/projects/06-answer-sheets/answer-sheet-management/types"
import { useCallback, useState } from "react"
import { toast } from "sonner"
import type { StudentData } from "../components"

export function useAnswerSheetsData(projectId: string) {
  const [students, setStudents] = useState<StudentData[]>([])
  const [answerSheets, setAnswerSheets] = useState<ProcessedAnswerSheet[]>([])
  const [masterImageCount, setMasterImageCount] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(true)

  const loadData = useCallback(async () => {
    if (!projectId) return

    try {
      setIsLoading(true)

      // Load students
      const projectStudentsResult =
        await window.electronAPI.getStudentsForProject(projectId)
      if (projectStudentsResult.success && projectStudentsResult.students) {
        const sortedStudents = projectStudentsResult.students
          .sort((a: any, b: any) => {
            if (
              a.customOrder !== null &&
              a.customOrder !== undefined &&
              b.customOrder !== null &&
              b.customOrder !== undefined
            ) {
              return a.customOrder - b.customOrder
            }
            if (a.customOrder !== null && a.customOrder !== undefined) return -1
            if (b.customOrder !== null && b.customOrder !== undefined) return 1

            const aNumber = a.memberships?.[0]?.attendanceNumber
            const bNumber = b.memberships?.[0]?.attendanceNumber
            if (aNumber && bNumber) return aNumber - bNumber
            if (aNumber) return -1
            if (bNumber) return 1

            const aName = `${a.lastName}${a.firstName}`
            const bName = `${b.lastName}${b.firstName}`
            return aName.localeCompare(bName)
          })
          .map((student: any) => ({
            id: student.id,
            lastName: student.lastName,
            firstName: student.firstName,
            lastNameKana: student.lastNameKana,
            firstNameKana: student.firstNameKana,
            studentId: student.studentId,
            attendanceNumber:
              student.memberships?.[0]?.attendanceNumber || null,
            status: student.status,
            customOrder: student.customOrder ?? null,
          }))

        setStudents(sortedStudents)
      }

      // Load answer sheets
      const answerSheetsResult =
        await window.electronAPI.getAnswerSheetsByProjectId(projectId)
      if (answerSheetsResult.success && answerSheetsResult.answerSheets) {
        setAnswerSheets(answerSheetsResult.answerSheets)
      }

      // Load master image count
      try {
        const masterImages =
          await window.electronAPI.getMasterImagesByProjectId(projectId)
        const maxPages =
          masterImages && masterImages.length > 0
            ? Math.max(...masterImages.map((img: any) => img.pageNumber))
            : 0
        setMasterImageCount(maxPages)
      } catch (error) {
        console.error("Failed to load master image count:", error)
        setMasterImageCount(0)
      }
    } catch (error) {
      console.error("Error loading data:", error)
      toast.error("データの読み込みに失敗しました")
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  return {
    students,
    answerSheets,
    masterImageCount,
    isLoading,
    loadData,
  }
}

export function usePendingChanges(
  onDataReload: () => Promise<void>,
  students?: StudentData[],
  answerSheets?: ProcessedAnswerSheet[],
) {
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([])
  const [affectedCells, setAffectedCells] = useState<Set<string>>(new Set())
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)

  const handleUpdatePendingChanges = useCallback(
    (changedFiles: Array<{ fileId: string; fromState: any; toState: any }>) => {
      console.log(
        "🔄 Creating pending changes from changed files:",
        changedFiles,
      )

      // PendingChange配列を一括作成
      const newPendingChanges = changedFiles.map(
        ({ fileId, fromState, toState }) => {
          // 生徒名を解決
          const fromStudent = students?.find(
            (s) => s.id === fromState.studentId,
          )
          const toStudent = students?.find((s) => s.id === toState.studentId)

          // 移動先にある既存ファイルを特定
          // answerSheetsから移動先位置(toState.studentId, toState.pageNumber)にあるファイルを検索
          const targetFile = answerSheets?.find(
            (sheet) =>
              sheet.studentId === toState.studentId &&
              sheet.pageNumber === toState.pageNumber &&
              sheet.id !== fileId, // 移動されたファイル自体は除外
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
            totalAnswerSheets: answerSheets?.length || 0,
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
        },
      )

      // 一括更新
      setPendingChanges(newPendingChanges)
      setAffectedCells(new Set(changedFiles.map(({ fileId }) => fileId)))
    },
    [students, answerSheets],
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
          moves: allMoves.map((m) => ({
            fileId: m.fileId.substring(0, 8) + "...",
            to: `${m.finalStudentId?.substring(0, 8) || "null"}...page${m.finalPageNumber}`,
          })),
        })

        // 一括移動処理：トランザクション内で全ての移動を同時実行
        console.log("📝 Calling batch placement update...")
        const result =
          await window.electronAPI.batchUpdateAnswerSheetPlacements(
            allMoves,
            option === "with-scoring",
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
          `${pendingChanges.length}件の変更を適用しました（${optionText}）`,
        )
      } catch (error) {
        console.error("変更の適用に失敗しました:", error)

        // エラー時も結局DB再読み込みで解決（resetFn不要）
        await onDataReload()

        toast.error("変更の適用に失敗しました。元の状態に戻しました。")
        throw error
      }
    },
    [pendingChanges, onDataReload],
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
