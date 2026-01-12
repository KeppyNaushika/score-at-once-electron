"use client"

import { useCallback, useEffect, useState } from "react"

import type {
  ClassGroup,
  GradingDataInfo,
  Student,
  StudentForRemoval,
  StudentMembership,
  StudentStatus,
} from "@/components/projects/05-students/components/project-students-page/types/projectStudentsTypes"

interface UseProjectStudentsDataProps {
  projectId: string
}

export function useProjectStudentsData({
  projectId,
}: UseProjectStudentsDataProps) {
  const [loading, setLoading] = useState(true)
  const [students, setStudents] = useState<Student[]>([]) // 順序付き生徒リスト
  const [classes, setClasses] = useState<ClassGroup[]>([]) // フィルタ用学級情報
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
      window.electronAPI.getStudentsForProject(projectId),
      window.electronAPI.projectClass.getStudentClassInfo(projectId),
    ])

    if (studentsResult.success && studentsResult.students) {
      // ProjectClass経由の学級情報をマージ
      const studentsWithClassInfo = studentsResult.students.map(
        (student: Student) => ({
          ...student,
          projectClassInfo: classInfoResult?.[student.id] ?? null,
        })
      )

      // 受験生徒をcustomOrder順で並び替え（ProjectStudentテーブルの順序が基準）
      const sortedStudents = [...studentsWithClassInfo].sort(
        (a: Student, b: Student) => {
          // customOrderが設定されている場合はそれを優先
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

          // customOrderが未設定の場合はデフォルト順序（追加順など）
          return 0
        }
      )

      setStudents(sortedStudents)

      // フィルタ用学級リスト: 受験生徒の所属履歴から抽出（表示のみ）
      const uniqueClasses = new Map<string, { id: string; name: string }>()

      sortedStudents.forEach((student) => {
        // 各生徒の全所属履歴を確認
        student.memberships?.forEach((membership: StudentMembership) => {
          if (!uniqueClasses.has(membership.class.id)) {
            uniqueClasses.set(membership.class.id, {
              id: membership.class.id,
              name: membership.class.name,
            })
          }
        })
      })

      // フィルタ用学級リストをセット（表示用のみ、データ構造には影響しない）
      const filterClasses: ClassGroup[] = Array.from(
        uniqueClasses.values()
      ).map((cls) => ({
        ...cls,
        students: [], // 空配列 - フィルタ用なので実際の生徒リストは不要
      }))

      setClasses(filterClasses)
    } else {
      console.error("Failed to refresh student data:", studentsResult.error)
    }
  }, [projectId])

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
      const result = await window.electronAPI.updateStudentProjectStatus(
        projectId,
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
    projectId: string,
    studentOrders: { studentId: string; customOrder: number }[]
  ) => {
    try {
      const result = await window.electronAPI.updateStudentOrders(
        projectId,
        studentOrders
      )
      if (!result.success) {
        throw new Error(result.error || "Failed to update student orders")
      }

      // 成功した場合、受験生徒リストのcustomOrderを更新し、再ソート
      const orderMap = new Map(
        studentOrders.map((o) => [o.studentId, o.customOrder])
      )

      setStudents((prevStudents) => {
        const updatedStudents = prevStudents.map((student) => ({
          ...student,
          customOrder: orderMap.get(student.id) ?? student.customOrder,
        }))

        // customOrder順で再ソート
        return updatedStudents.sort((a, b) => {
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
          return 0
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
          (membership) => membership.class.id === selectedClassId
        )

      return matchesSearch && matchesStatus && matchesClass
    })

    if (isSelected) {
      setSelectedStudentsForRemoval(new Set(filteredStudents.map((s) => s.id)))
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
        await window.electronAPI.checkGradingDataForStudents(
          projectId,
          studentIds
        )
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
      const result = await window.electronAPI.removeStudentsFromProject(
        projectId,
        studentsToRemove
      )
      if (!result.success) {
        throw new Error(
          result.error || "Failed to remove students from project"
        )
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
        (membership) => membership.class.id === selectedClassId
      )

    return matchesSearch && matchesStatus && matchesClass
  })

  // 削除用生徒データの作成
  const studentsForRemovalData: StudentForRemoval[] = studentsToRemove.map(
    (id) => {
      const student = students.find((s) => s.id === id)
      return {
        id,
        studentNumber: student?.studentNumber || "",
        lastName: student?.lastName || "",
        firstName: student?.firstName || "",
        className: student?.memberships?.[0]?.class.name || "未所属",
      }
    }
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
