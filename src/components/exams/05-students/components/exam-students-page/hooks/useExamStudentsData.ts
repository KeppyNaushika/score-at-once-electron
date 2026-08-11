"use client"

import { useCallback, useEffect, useState } from "react"

import type { RosterClassroomOption } from "@/components/common/roster-table"
import {
  type ExamClassroomPlacement,
  resolveExamClassroomPlacement,
} from "@/lib/examClassroomPlacement"
import type { ExamStudentStatus } from "@/types/examStudentStatus.types"
import type { ExamStudentWithMemberships } from "@/types/prismaExtensions"

interface UseExamStudentsDataProps {
  examId: string
}

/**
 * customOrder → 学級順（placement.classroomOrder）→ 出席番号順で受験生徒を比較する。
 * placement（ExamClassroom 由来の表示学級情報）は studentId をキーに別持ちする side data。
 */
function compareExamStudents(
  placementByStudent: Record<string, ExamClassroomPlacement>
) {
  return (
    examStudentA: ExamStudentWithMemberships,
    examStudentB: ExamStudentWithMemberships
  ): number => {
    // customOrder が設定されている場合はそれを優先
    if (
      examStudentA.customOrder !== null &&
      examStudentA.customOrder !== undefined &&
      examStudentB.customOrder !== null &&
      examStudentB.customOrder !== undefined
    ) {
      return examStudentA.customOrder - examStudentB.customOrder
    }
    if (
      examStudentA.customOrder !== null &&
      examStudentA.customOrder !== undefined
    )
      return -1
    if (
      examStudentB.customOrder !== null &&
      examStudentB.customOrder !== undefined
    )
      return 1

    // customOrder が未設定の場合はデフォルト順（学級順→出席番号順）
    const placementA = placementByStudent[examStudentA.studentId]
    const placementB = placementByStudent[examStudentB.studentId]
    const classroomOrderA = placementA?.order ?? 99999
    const classroomOrderB = placementB?.order ?? 99999
    if (classroomOrderA !== classroomOrderB)
      return classroomOrderA - classroomOrderB

    const attendanceA = placementA?.attendanceNumber ?? 99999
    const attendanceB = placementB?.attendanceNumber ?? 99999
    if (attendanceA !== attendanceB) return attendanceA - attendanceB

    // 同順位はふりがな→生徒番号で決定的に順序付ける
    const kanaA = `${examStudentA.student.lastNameKana} ${examStudentA.student.firstNameKana}`
    const kanaB = `${examStudentB.student.lastNameKana} ${examStudentB.student.firstNameKana}`
    const kanaComparison = kanaA.localeCompare(kanaB, "ja")
    if (kanaComparison !== 0) return kanaComparison
    return examStudentA.student.studentNumber.localeCompare(
      examStudentB.student.studentNumber,
      "ja"
    )
  }
}

/** 試験の受験生徒一覧の取得・フィルタ・ステータス更新・並び替え・削除を管理するフック */
export function useExamStudentsData({ examId }: UseExamStudentsDataProps) {
  // 読み込みが済んだ試験。表示中の examId と食い違っている間が読み込み中
  const [loadedExamId, setLoadedExamId] = useState<string | null>(null)
  const [examStudents, setExamStudents] = useState<
    ExamStudentWithMemberships[]
  >([]) // 順序付き受験生徒リスト
  // ExamClassroom(administered=true) 由来の表示学級情報。ExamStudentWithMemberships にマージせず
  // studentId をキーに別持ちする side data（getStudentsForExam の戻り値には含まれない）。
  const [placementByStudent, setPlacementByStudent] = useState<
    Record<string, ExamClassroomPlacement>
  >({})
  const [classrooms, setClassrooms] = useState<RosterClassroomOption[]>([]) // フィルタ用学級情報
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<ExamStudentStatus | "all">(
    "all"
  )
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>("all")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showRemovalConfirm, setShowRemovalConfirm] = useState(false)
  const [studentsToRemove, setStudentsToRemove] = useState<string[]>([])
  const [selectedStudentsForRemoval, setSelectedStudentsForRemoval] = useState<
    Set<string>
  >(new Set())
  const [gradingItemCount, setGradingItemCount] = useState(0)

  const loading = loadedExamId !== examId

  // データの再読み込み
  const refreshStudentData = useCallback(async () => {
    try {
      const [studentsResult, administeredClassrooms] = await Promise.all([
        window.electronAPI.getStudentsForExam(examId),
        window.electronAPI.examClassroom.getAdministered(examId),
      ])

      if (studentsResult.success && studentsResult.students) {
        // 採番学級は administered 学級（DB 構造）から renderer 側で解決する
        const placement = resolveExamClassroomPlacement(administeredClassrooms)

        // 受験生徒を customOrder 順で並び替え（ExamStudent テーブルの順序が基準）
        const sortedExamStudents = [...studentsResult.students].sort(
          compareExamStudents(placement)
        )

        setExamStudents(sortedExamStudents)
        setPlacementByStudent(placement)

        // フィルタ用学級リスト: 受験生徒の所属履歴から抽出（id/name のみ）
        const uniqueClasses = new Map<string, RosterClassroomOption>()
        sortedExamStudents.forEach((examStudent) => {
          // 各生徒の全所属履歴を確認
          examStudent.student.memberships?.forEach((membership) => {
            if (!uniqueClasses.has(membership.classroom.id)) {
              uniqueClasses.set(membership.classroom.id, {
                id: membership.classroom.id,
                name: membership.classroom.name,
              })
            }
          })
        })
        setClassrooms(Array.from(uniqueClasses.values()))
      } else {
        console.error("Failed to refresh student data:", studentsResult.error)
      }
    } finally {
      setLoadedExamId(examId)
    }
  }, [examId])

  // データの取得（実際のAPIから）
  useEffect(() => {
    refreshStudentData()
  }, [refreshStudentData])

  // 生徒の状態を更新
  const updateStudentStatus = async (
    studentId: string,
    newStatus: ExamStudentStatus
  ) => {
    try {
      const result = await window.electronAPI.updateStudentExamStatus(
        examId,
        studentId,
        newStatus
      )
      if (!result.success) {
        throw new Error(result.error || "Failed to update student status")
      }

      // 受験生徒リストのステータスを更新
      setExamStudents((prevExamStudents) =>
        prevExamStudents.map((examStudent) =>
          examStudent.studentId === studentId
            ? { ...examStudent, status: newStatus }
            : examStudent
        )
      )
    } catch (error) {
      console.error("Failed to update student status:", error)
    }
  }

  // 生徒の並び順を更新
  const updateStudentOrders = async (
    examId: string,
    studentOrders: { studentId: string; customOrder: number }[]
  ) => {
    try {
      const result = await window.electronAPI.updateStudentOrders(
        examId,
        studentOrders
      )
      if (!result.success) {
        throw new Error(result.error || "Failed to update student orders")
      }

      // 成功した場合、受験生徒リストの customOrder を更新し、再ソート
      const orderMap = new Map(
        studentOrders.map((studentOrder) => [
          studentOrder.studentId,
          studentOrder.customOrder,
        ])
      )

      setExamStudents((prevExamStudents) => {
        const updatedExamStudents = prevExamStudents.map((examStudent) => ({
          ...examStudent,
          customOrder:
            orderMap.get(examStudent.studentId) ?? examStudent.customOrder,
        }))
        return updatedExamStudents.sort(compareExamStudents(placementByStudent))
      })
    } catch (error) {
      console.error("Failed to update student orders:", error)
    }
  }

  // 生徒選択の変更（SortableStudentTable用）
  const handleStudentSelectionChange = (
    studentId: string,
    isSelected: boolean
  ) => {
    setSelectedStudentsForRemoval((prev) => {
      const newSet = new Set(prev)
      if (isSelected) {
        newSet.add(studentId)
      } else {
        newSet.delete(studentId)
      }
      return newSet
    })
  }

  // 表示用フィルタ（検索・受験状態・学級）に合致するか
  const matchesFilters = useCallback(
    (examStudent: ExamStudentWithMemberships): boolean => {
      const student = examStudent.student
      const fullName = `${student.lastName} ${student.firstName}`
      const fullKana = `${student.lastNameKana} ${student.firstNameKana}`
      const matchesSearch =
        fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        fullKana.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.studentNumber.includes(searchTerm)

      const matchesStatus =
        statusFilter === "all" || examStudent.status === statusFilter

      // 学級フィルタ: 任意の所属履歴に該当学級があるかチェック
      const matchesClassroom =
        selectedClassroomId === "all" ||
        student.memberships?.some(
          (membership) => membership.classroom.id === selectedClassroomId
        )

      return matchesSearch && matchesStatus && matchesClassroom
    },
    [searchTerm, statusFilter, selectedClassroomId]
  )

  // 全選択の処理（SortableStudentTable用）
  const handleSelectAll = (isSelected: boolean) => {
    const filtered = examStudents.filter(matchesFilters)
    if (isSelected) {
      setSelectedStudentsForRemoval(
        new Set(filtered.map((examStudent) => examStudent.studentId))
      )
    } else {
      setSelectedStudentsForRemoval(new Set())
    }
  }

  // 選択した生徒の削除開始
  const initiateStudentRemoval = async () => {
    if (selectedStudentsForRemoval.size === 0) return

    const studentIds = Array.from(selectedStudentsForRemoval)
    setStudentsToRemove(studentIds)

    // 採点データの存在を確認
    try {
      const gradingResult =
        await window.electronAPI.checkGradingDataForStudents(examId, studentIds)
      if (gradingResult.success) {
        setGradingItemCount(gradingResult.totalGradingItems || 0)
      } else {
        setGradingItemCount(0)
      }
    } catch (error) {
      console.error("Failed to check grading data:", error)
      setGradingItemCount(0)
    }

    setShowRemovalConfirm(true)
  }

  // 生徒削除の確定実行
  const confirmStudentRemoval = async () => {
    try {
      const result = await window.electronAPI.removeStudentsFromExam(
        examId,
        studentsToRemove
      )
      if (!result.success) {
        throw new Error(result.error || "Failed to remove students from exam")
      }

      // データを再読み込み（新しいアーキテクチャに対応）
      await refreshStudentData()

      // 状態をリセット
      setSelectedStudentsForRemoval(new Set())
      setStudentsToRemove([])
      setShowRemovalConfirm(false)
    } catch (error) {
      console.error("Failed to remove students:", error)
    }
  }

  // フィルタリングされた受験生徒リスト（順序を維持したまま表示用フィルタを適用）
  const filteredStudents = examStudents.filter(matchesFilters)

  // 削除対象の受験生徒（実体をそのまま渡す。射影型は作らない）
  const removeIdSet = new Set(studentsToRemove)
  const studentsForRemovalData = examStudents.filter((examStudent) =>
    removeIdSet.has(examStudent.studentId)
  )

  return {
    loading,
    students: examStudents,
    placementByStudent,
    classrooms,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    selectedClassroomId,
    setSelectedClassroomId,
    showAddDialog,
    setShowAddDialog,
    showRemovalConfirm,
    setShowRemovalConfirm,
    setStudentsToRemove,
    selectedStudentsForRemoval,
    gradingItemCount,
    refreshStudentData,
    updateStudentStatus,
    updateStudentOrders,
    handleStudentSelectionChange,
    handleSelectAll,
    initiateStudentRemoval,
    confirmStudentRemoval,
    filteredStudents,
    studentsForRemovalData,
  }
}
