"use client"

import { useCallback, useEffect, useState } from "react"

import type {
  AddPanelClassItem,
  AddPanelStudentItem,
  StudentAddPanelAdapter,
} from "@/components/common/student-add-panel/types/studentAddPanelTypes"

interface SelectableClass extends AddPanelClassItem {
  isSelected: boolean
}

interface SelectableStudent extends AddPanelStudentItem {
  isSelected: boolean
}

interface UseStudentAddPanelParams {
  adapter: StudentAddPanelAdapter
  onAdded: () => void
  classActiveOnlyDefault: boolean
  studentActiveOnlyDefault: boolean
}

/**
 * 共通「生徒追加パネル」の状態管理
 *
 * 学級複数選択・個別検索選択・在籍スイッチ2系統（学級用/個別用）を持ち、
 * スイッチ切替時に該当の候補だけ再取得する。追加後は両候補を再取得し onAdded を呼ぶ。
 */
export function useStudentAddPanel({
  adapter,
  onAdded,
  classActiveOnlyDefault,
  studentActiveOnlyDefault,
}: UseStudentAddPanelParams) {
  const [activeTab, setActiveTab] = useState("classes")
  const [classes, setClasses] = useState<SelectableClass[]>([])
  const [students, setStudents] = useState<SelectableStudent[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [filterClassId, setFilterClassId] = useState("all")
  const [classActiveOnly, setClassActiveOnly] = useState(classActiveOnlyDefault)
  const [studentActiveOnly, setStudentActiveOnly] = useState(
    studentActiveOnlyDefault
  )
  const [loadingClasses, setLoadingClasses] = useState(false)
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [isAdding, setIsAdding] = useState(false)

  const loadClasses = useCallback(async () => {
    setLoadingClasses(true)
    try {
      const result = await adapter.fetchAvailableClasses(classActiveOnly)
      setClasses(result.map((c) => ({ ...c, isSelected: false })))
    } catch (error) {
      console.error("Failed to fetch available classes:", error)
    } finally {
      setLoadingClasses(false)
    }
  }, [adapter, classActiveOnly])

  const loadStudents = useCallback(async () => {
    setLoadingStudents(true)
    try {
      const result = await adapter.fetchAvailableStudents(studentActiveOnly)
      setStudents(result.map((s) => ({ ...s, isSelected: false })))
    } catch (error) {
      console.error("Failed to fetch available students:", error)
    } finally {
      setLoadingStudents(false)
    }
  }, [adapter, studentActiveOnly])

  useEffect(() => {
    loadClasses()
  }, [loadClasses])

  useEffect(() => {
    loadStudents()
  }, [loadStudents])

  const handleClassSelection = (classId: string, isSelected: boolean) => {
    setClasses((prev) =>
      prev.map((c) => (c.id === classId ? { ...c, isSelected } : c))
    )
  }

  const handleClassReorder = (orderedIds: string[]) => {
    setClasses((prev) => {
      const byId = new Map(prev.map((c) => [c.id, c]))
      const reordered = orderedIds
        .map((id) => byId.get(id))
        .filter((c): c is SelectableClass => c !== undefined)
      // 並び替え対象（選択済み）以外はそのまま末尾に残す
      const rest = prev.filter((c) => !orderedIds.includes(c.id))
      return [...reordered, ...rest]
    })
  }

  const handleStudentSelection = (studentId: string, isSelected: boolean) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, isSelected } : s))
    )
  }

  const handleAddClasses = async () => {
    const selected = classes.filter((c) => c.isSelected)
    if (selected.length === 0) return
    setIsAdding(true)
    try {
      await adapter.addClasses(
        selected.map((c) => c.id),
        classActiveOnly
      )
      await Promise.all([loadClasses(), loadStudents()])
      onAdded()
    } catch (error) {
      console.error("Failed to add classes:", error)
      alert(
        "学級の追加に失敗しました: " +
          (error instanceof Error ? error.message : "Unknown error")
      )
    } finally {
      setIsAdding(false)
    }
  }

  const handleAddStudents = async () => {
    const selected = students.filter((s) => s.isSelected)
    if (selected.length === 0) return
    setIsAdding(true)
    try {
      await adapter.addStudents(selected.map((s) => s.id))
      await Promise.all([loadClasses(), loadStudents()])
      onAdded()
    } catch (error) {
      console.error("Failed to add students:", error)
      alert(
        "生徒の追加に失敗しました: " +
          (error instanceof Error ? error.message : "Unknown error")
      )
    } finally {
      setIsAdding(false)
    }
  }

  const filteredStudents = students.filter((student) => {
    const fullName = `${student.lastName} ${student.firstName}`.toLowerCase()
    const fullKana =
      `${student.lastNameKana} ${student.firstNameKana}`.toLowerCase()
    const term = searchTerm.toLowerCase()
    const matchesSearch =
      fullName.includes(term) ||
      fullKana.includes(term) ||
      student.studentNumber.toLowerCase().includes(term)
    const matchesClass =
      filterClassId === "all" ||
      student.memberships.some((m) => m.class.id === filterClassId)
    return matchesSearch && matchesClass
  })

  const selectedClasses = classes.filter((c) => c.isSelected)
  const selectedClassCount = selectedClasses.length
  const selectedStudentCount = students.filter((s) => s.isSelected).length

  return {
    activeTab,
    setActiveTab,
    classes,
    selectedClasses,
    students,
    filteredStudents,
    searchTerm,
    setSearchTerm,
    filterClassId,
    setFilterClassId,
    classActiveOnly,
    setClassActiveOnly,
    studentActiveOnly,
    setStudentActiveOnly,
    loadingClasses,
    loadingStudents,
    isAdding,
    selectedClassCount,
    selectedStudentCount,
    handleClassSelection,
    handleClassReorder,
    handleStudentSelection,
    handleAddClasses,
    handleAddStudents,
  }
}
