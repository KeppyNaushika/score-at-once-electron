"use client"

import { useCallback, useEffect, useState } from "react"
import type {
  AvailableClass,
  AvailableStudent,
} from "@/components/projects/05-students/components/project-student-add-modal/types/project-student-add-types"

interface UseProjectStudentAddModalProps {
  isOpen: boolean
  projectId: string
  onStudentsAdded: () => void
  onClose: () => void
}

export function useProjectStudentAddModal({
  isOpen,
  projectId,
  onStudentsAdded,
  onClose,
}: UseProjectStudentAddModalProps) {
  const [activeTab, setActiveTab] = useState("classes")
  const [availableClasses, setAvailableClasses] = useState<AvailableClass[]>([])
  const [availableStudents, setAvailableStudents] = useState<
    AvailableStudent[]
  >([])
  const [searchTerm, setSearchTerm] = useState("")
  const [filterClassId, setFilterClassId] = useState<string>("all")
  const [loading, setLoading] = useState(false)
  const [isAdding, setIsAdding] = useState(false)

  const fetchAvailableData = useCallback(async () => {
    setLoading(true)
    try {
      // 利用可能な学級を取得
      const classesResult =
        await window.electronAPI.getClassesNotInProject(projectId)
      if (classesResult.success && classesResult.classes) {
        setAvailableClasses(
          classesResult.classes.map((cls) => ({
            ...cls,
            isSelected: false,
          }))
        )
      }

      // 利用可能な生徒を取得
      const studentsResult =
        await window.electronAPI.getStudentsNotInProject(projectId)
      if (studentsResult.success && studentsResult.students) {
        setAvailableStudents(
          studentsResult.students.map((student) => ({
            ...student,
            isSelected: false,
          }))
        )
      }
    } catch (error) {
      console.error("Failed to fetch available data:", error)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  // データの取得
  useEffect(() => {
    if (isOpen) {
      fetchAvailableData()
    }
  }, [isOpen, fetchAvailableData])

  // 学級選択の処理
  const handleClassSelection = (classId: string, isSelected: boolean) => {
    setAvailableClasses((prev) =>
      prev.map((cls) => (cls.id === classId ? { ...cls, isSelected } : cls))
    )
  }

  // 学級順序の更新
  const handleClassReorder = (reorderedClasses: AvailableClass[]) => {
    setAvailableClasses(reorderedClasses)
  }

  // 生徒選択の処理
  const handleStudentSelection = (studentId: string, isSelected: boolean) => {
    setAvailableStudents((prev) =>
      prev.map((student) =>
        student.id === studentId ? { ...student, isSelected } : student
      )
    )
  }

  // 学級ごとの生徒追加
  const handleAddClassStudents = async () => {
    setIsAdding(true)
    try {
      const selectedClasses = availableClasses.filter((cls) => cls.isSelected)

      // 選択された学級の順序で生徒を追加
      let currentOrder = 0

      for (const classItem of selectedClasses) {
        // 学級の全生徒を取得
        const allClasses = await window.electronAPI.fetchClasses()
        const fullClassData = allClasses.find((cls) => cls.id === classItem.id)

        if (!fullClassData || !fullClassData.memberships) {
          console.warn(`Class ${classItem.name} has no students`)
          continue
        }

        // 学級の生徒を出席番号順にソート（所属履歴のある全生徒）
        const sortedStudents = [...fullClassData.memberships]
          .filter(
            (membership) => membership.student // 生徒データが存在することを確認
            // endDateの有無は問わない - 過去の所属生徒も追加可能にする
          )
          .sort((a, b) => {
            const aNum = a.attendanceNumber || 9999
            const bNum = b.attendanceNumber || 9999
            return aNum - bNum
          })

        // 生徒IDのリストを作成
        const studentIds = sortedStudents
          .map((membership) => membership.student?.id)
          .filter((id): id is string => !!id) // undefined を除外

        if (studentIds.length > 0) {
          // プロジェクトに生徒を追加
          const result = await window.electronAPI.addStudentsToProject(
            projectId,
            studentIds
          )

          if (!result.success) {
            throw new Error(
              result.error ||
                `Failed to add students from class ${classItem.name}`
            )
          }

          // 生徒の順序を設定（学級順→出席番号順）
          const studentOrders = studentIds.map((studentId, index) => ({
            studentId,
            customOrder: currentOrder + index + 1,
          }))

          const orderResult = await window.electronAPI.updateStudentOrders(
            projectId,
            studentOrders
          )

          if (!orderResult.success) {
            console.warn(
              `Failed to update student orders for class ${classItem.name}:`,
              orderResult.error
            )
          }

          currentOrder += studentIds.length
        }
      }

      onStudentsAdded()
      handleClose()
    } catch (error) {
      console.error("Failed to add class students:", error)
      alert(
        "学級の追加に失敗しました: " +
          (error instanceof Error ? error.message : "Unknown error")
      )
    } finally {
      setIsAdding(false)
    }
  }

  // 個別生徒の追加
  const handleAddIndividualStudents = async () => {
    setIsAdding(true)
    try {
      const selectedStudents = availableStudents.filter(
        (student) => student.isSelected
      )
      const studentIds = selectedStudents.map((student) => student.id)

      const result = await window.electronAPI.addStudentsToProject(
        projectId,
        studentIds
      )
      if (!result.success) {
        throw new Error(result.error || "Failed to add students")
      }

      onStudentsAdded()
      handleClose()
    } catch (error) {
      console.error("Failed to add individual students:", error)
      alert("生徒の追加に失敗しました。")
    } finally {
      setIsAdding(false)
    }
  }

  // モーダルを閉じる
  const handleClose = () => {
    setAvailableClasses([])
    setAvailableStudents([])
    setSearchTerm("")
    setFilterClassId("all")
    setActiveTab("classes")
    onClose()
  }

  // フィルタリングされた生徒
  const filteredStudents = availableStudents.filter((student) => {
    const fullName = `${student.lastName} ${student.firstName}`
    const fullKana = `${student.lastNameKana} ${student.firstNameKana}`
    const matchesSearch =
      fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fullKana.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.studentId.includes(searchTerm)

    // 学級フィルタ: 任意の所属履歴に該当学級があるかチェック（endDate問わず）
    const matchesClass =
      filterClassId === "all" ||
      student.memberships?.some(
        (membership) => membership.class.id === filterClassId
      )

    return matchesSearch && matchesClass
  })

  const selectedClassCount = availableClasses.filter(
    (cls) => cls.isSelected
  ).length
  const selectedStudentCount = availableStudents.filter(
    (student) => student.isSelected
  ).length

  return {
    activeTab,
    setActiveTab,
    availableClasses,
    availableStudents,
    searchTerm,
    setSearchTerm,
    filterClassId,
    setFilterClassId,
    loading,
    isAdding,
    filteredStudents,
    selectedClassCount,
    selectedStudentCount,
    handleClassSelection,
    handleClassReorder,
    handleStudentSelection,
    handleAddClassStudents,
    handleAddIndividualStudents,
    handleClose,
  }
}
