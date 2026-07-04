"use client"

import { useCallback, useEffect, useState } from "react"

import type { RosterClassOption } from "@/components/common/roster-table"
import type {
  GradingDataInfo,
  Student,
} from "@/components/exams/05-students/components/exam-students-page/types/examStudentsTypes"
import type { StudentStatus } from "@/types/studentStatus.types"

interface UseExamStudentsDataProps {
  examId: string
}

/** 試験の受験生徒一覧の取得・フィルタ・ステータス更新・並び替え・削除を管理するフック */
export function useExamStudentsData({ examId }: UseExamStudentsDataProps) {
  const [loading, setLoading] = useState(true)
  const [students, setStudents] = useState<Student[]>([]) // 順序付き生徒リスト
  const [classes, setClasses] = useState<RosterClassOption[]>([]) // フィルタ用学級情報
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<StudentStatus | "all">("all")
  const [selectedClassId, setSelectedClassId] = useState<string>("all")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showRemovalConfirm, setShowRemovalConfirm] = useState(false)
  const [studentsToRemove, setStudentsToRemove] = useState<string[]>([])
  const [selectedStudentsForRemoval, setSelectedStudentsForRemoval] = useState<
    Set<string>
  >(new Set())
  const [gradingDataInfo, setGradingDataInfo] = useState<GradingDataInfo>({
    hasData: false,
    totalItems: 0,
  })

  // データの再読み込み
  const refreshStudentData = useCallback(async () => {
    const [studentsResult, classInfoResult] = await Promise.all([
      window.electronAPI.getStudentsForExam(examId),
      window.electronAPI.examClassroom.getStudentClassInfo(examId),
    ])

    if (studentsResult.success && studentsResult.students) {
      // ExamClass経由の学級情報をマージ
      const studentsWithClassInfo = studentsResult.students.map(
        (student: Student) => ({
          ...student,
          examClassInfo: classInfoResult?.[student.id] ?? null,
        })
      )

      // 受験生徒をcustomOrder順で並び替え（ExamStudentテーブルの順序が基準）
      const sortedStudents = [...studentsWithClassInfo].sort(
        (studentA: Student, studentB: Student) => {
          // customOrderが設定されている場合はそれを優先
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

          // customOrderが未設定の場合はデフォルト順（学級順→出席番号順）
          const aClassOrder = studentA.examClassInfo?.classOrder ?? 99999
          const bClassOrder = studentB.examClassInfo?.classOrder ?? 99999
          if (aClassOrder !== bClassOrder) return aClassOrder - bClassOrder

          const aAttendance = studentA.examClassInfo?.attendanceNumber ?? 99999
          const bAttendance = studentB.examClassInfo?.attendanceNumber ?? 99999
          return aAttendance - bAttendance
        }
      )

      setStudents(sortedStudents)

      // フィルタ用学級リスト: 受験生徒の所属履歴から抽出（id/name のみ）
      const uniqueClasses = new Map<string, RosterClassOption>()

      sortedStudents.forEach((student) => {
        // 各生徒の全所属履歴を確認
        student.memberships?.forEach((membership) => {
          if (!uniqueClasses.has(membership.classroom.id)) {
            uniqueClasses.set(membership.classroom.id, {
              id: membership.classroom.id,
              name: membership.classroom.name,
            })
          }
        })
      })

      setClasses(Array.from(uniqueClasses.values()))
    } else {
      console.error("Failed to refresh student data:", studentsResult.error)
    }
  }, [examId])

  // データの取得（実際のAPIから）
  useEffect(() => {
    setLoading(true)
    refreshStudentData().finally(() => setLoading(false))
  }, [refreshStudentData])

  // 生徒の状態を更新
  const updateStudentStatus = async (
    studentId: string,
    newStatus: StudentStatus
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
      setStudents((prevStudents) =>
        prevStudents.map((student) =>
          student.id === studentId ? { ...student, status: newStatus } : student
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

      // 成功した場合、受験生徒リストのcustomOrderを更新し、再ソート
      const orderMap = new Map(
        studentOrders.map((studentOrder) => [
          studentOrder.studentId,
          studentOrder.customOrder,
        ])
      )

      setStudents((prevStudents) => {
        const updatedStudents = prevStudents.map((student) => ({
          ...student,
          customOrder: orderMap.get(student.id) ?? student.customOrder,
        }))

        // customOrder順で再ソート
        return updatedStudents.sort((studentA, studentB) => {
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

          // 両方nullの場合はデフォルト順（学級順→出席番号順）
          const aClassOrder = studentA.examClassInfo?.classOrder ?? 99999
          const bClassOrder = studentB.examClassInfo?.classOrder ?? 99999
          if (aClassOrder !== bClassOrder) return aClassOrder - bClassOrder

          const aAttendance = studentA.examClassInfo?.attendanceNumber ?? 99999
          const bAttendance = studentB.examClassInfo?.attendanceNumber ?? 99999
          return aAttendance - bAttendance
        })
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

  // 全選択の処理（SortableStudentTable用）
  const handleSelectAll = (isSelected: boolean) => {
    const filteredStudents = students.filter((student) => {
      const fullName = `${student.lastName} ${student.firstName}`
      const fullKana = `${student.lastNameKana} ${student.firstNameKana}`
      const matchesSearch =
        fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        fullKana.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.studentNumber.includes(searchTerm)

      const matchesStatus =
        statusFilter === "all" || student.status === statusFilter

      // 学級フィルタ: 任意の所属履歴に該当学級があるかチェック
      const matchesClass =
        selectedClassId === "all" ||
        student.memberships?.some(
          (membership) => membership.classroom.id === selectedClassId
        )

      return matchesSearch && matchesStatus && matchesClass
    })

    if (isSelected) {
      setSelectedStudentsForRemoval(
        new Set(filteredStudents.map((student) => student.id))
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
        setGradingDataInfo({
          hasData: gradingResult.hasAnyData || false,
          totalItems: gradingResult.totalGradingItems || 0,
        })
      } else {
        setGradingDataInfo({ hasData: false, totalItems: 0 })
      }
    } catch (error) {
      console.error("Failed to check grading data:", error)
      setGradingDataInfo({ hasData: false, totalItems: 0 })
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

  // フィルタリングされた生徒リスト（順序を維持したまま表示用フィルタを適用）
  const filteredStudents = students.filter((student) => {
    const fullName = `${student.lastName} ${student.firstName}`
    const fullKana = `${student.lastNameKana} ${student.firstNameKana}`
    const matchesSearch =
      fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fullKana.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.studentNumber.includes(searchTerm)

    const matchesStatus =
      statusFilter === "all" || student.status === statusFilter

    // 学級フィルタ: 任意の所属履歴に該当学級があるかチェック
    const matchesClass =
      selectedClassId === "all" ||
      student.memberships?.some(
        (membership) => membership.classroom.id === selectedClassId
      )

    return matchesSearch && matchesStatus && matchesClass
  })

  // 削除対象の生徒（実体をそのまま渡す。射影型は作らない）
  const removeIdSet = new Set(studentsToRemove)
  const studentsForRemovalData = students.filter((student) =>
    removeIdSet.has(student.id)
  )

  return {
    loading,
    students,
    classes,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    selectedClassId,
    setSelectedClassId,
    showAddDialog,
    setShowAddDialog,
    showRemovalConfirm,
    setShowRemovalConfirm,
    setStudentsToRemove,
    selectedStudentsForRemoval,
    gradingDataInfo,
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
