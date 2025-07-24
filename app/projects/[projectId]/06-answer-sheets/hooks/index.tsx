/**
 * Hooks for 06-answer-sheets page - quick inline version
 */

import { useCallback, useState, useEffect } from "react"
import { toast } from "sonner"
import type { AnswerSheetWithDetails } from "@/types/electron"
import type { PendingChange, ScoringDataOption } from "@/types/answer-sheet.types"
import type { StudentData } from "../components"

interface ProjectData {
  id: string
  name: string
  description?: string
}

export function useAnswerSheetsData(projectId: string) {
  const [project, setProject] = useState<ProjectData | null>(null)
  const [students, setStudents] = useState<StudentData[]>([])
  const [answerSheets, setAnswerSheets] = useState<AnswerSheetWithDetails[]>([])
  const [masterImageCount, setMasterImageCount] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(true)

  const loadData = useCallback(async () => {
    if (!projectId) return

    try {
      setIsLoading(true)

      // Load project
      const projectResult = await window.electronAPI.fetchProjectById(projectId)
      if (projectResult) {
        setProject({
          id: projectResult.id,
          name: projectResult.examName,
          description: projectResult.description || undefined,
        })
      }

      // Load students
      const projectStudentsResult = await window.electronAPI.getStudentsForProject(projectId)
      if (projectStudentsResult.success && projectStudentsResult.students) {
        const sortedStudents = projectStudentsResult.students
          .sort((a: any, b: any) => {
            if (a.customOrder !== null && a.customOrder !== undefined && 
                b.customOrder !== null && b.customOrder !== undefined) {
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
            attendanceNumber: student.memberships?.[0]?.attendanceNumber || null,
            status: student.status,
            customOrder: student.customOrder ?? null,
          }))

        setStudents(sortedStudents)
      }

      // Load answer sheets
      const answerSheetsResult = await window.electronAPI.getAnswerSheetsByProjectId(projectId)
      if (answerSheetsResult.success && answerSheetsResult.answerSheets) {
        setAnswerSheets(answerSheetsResult.answerSheets)
      }

      // Load master image count
      try {
        const masterImages = await window.electronAPI.getMasterImagesByProjectId(projectId)
        const maxPages = masterImages && masterImages.length > 0 
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
    project,
    students,
    answerSheets,
    masterImageCount,
    isLoading,
    loadData,
  }
}

export function usePendingChanges(onDataReload: () => Promise<void>, students?: StudentData[]) {
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([])
  const [affectedCells, setAffectedCells] = useState<Set<string>>(new Set())
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)

  const handleUpdatePendingChanges = useCallback((changedFiles: Array<{ fileId: string; fromState: any; toState: any }>) => {
    // PendingChange配列を一括作成
    const newPendingChanges = changedFiles.map(({ fileId, fromState, toState }) => {
      // 生徒名を解決
      const fromStudent = students?.find(s => s.id === fromState.studentId)
      const toStudent = students?.find(s => s.id === toState.studentId)

      const change: PendingChange = {
        id: `${fileId}-change-${Date.now()}-${fromState.studentId}-${fromState.pageNumber}-${toState.studentId}-${toState.pageNumber}`,
        answerSheetId1: fileId,
        answerSheetId2: fileId,
        timestamp: new Date(),
        position1: {
          studentId: fromState.studentId,
          pageNumber: fromState.pageNumber,
          studentName: fromStudent ? `${fromStudent.lastName} ${fromStudent.firstName}` : undefined,
        },
        position2: {
          studentId: toState.studentId,
          pageNumber: toState.pageNumber,
          studentName: toStudent ? `${toStudent.lastName} ${toStudent.firstName}` : undefined,
        },
      }
      return change
    })

    // 一括更新
    setPendingChanges(newPendingChanges)
    setAffectedCells(new Set(changedFiles.map(({ fileId }) => fileId)))
  }, [students])

  const handleApplyChanges = useCallback(async (option: ScoringDataOption, resetDragDropFn?: () => void) => {
    if (option === "cancel") {
      setPendingChanges([])
      setAffectedCells(new Set())
      // DnD配列も初期状態に戻す
      if (resetDragDropFn) {
        resetDragDropFn()
      }
      toast.info("変更をキャンセルしました")
      return
    }

    try {
      for (const change of pendingChanges) {
        if (option === "with-scoring") {
          await window.electronAPI.swapAnswerSheetPlacementsWithScoring(
            change.answerSheetId1,
            change.answerSheetId2
          )
        } else {
          await window.electronAPI.swapAnswerSheetPlacements(
            change.answerSheetId1,
            change.answerSheetId2
          )
        }
      }

      setPendingChanges([])
      setAffectedCells(new Set())
      await onDataReload()

      const optionText = option === "with-scoring" ? "採点情報込み" : "答案画像のみ"
      toast.success(`${pendingChanges.length}件の変更を適用しました（${optionText}）`)
    } catch (error) {
      console.error("変更の適用に失敗しました:", error)
      toast.error("変更の適用に失敗しました")
      throw error
    }
  }, [pendingChanges, onDataReload])

  return {
    pendingChanges,
    affectedCells,
    isConfirmModalOpen,
    handleUpdatePendingChanges,
    handleApplyChanges,
    openConfirmModal: () => setIsConfirmModalOpen(true),
    closeConfirmModal: () => setIsConfirmModalOpen(false),
  }
}