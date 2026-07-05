"use client"

import { useCallback, useEffect, useState } from "react"

import type {
  AddPanelClassroomItem,
  AddPanelStudentItem,
  StudentAddPanelAdapter,
} from "@/components/common/student-add-panel/types/studentAddPanelTypes"
import { isCurrentMembership } from "@/lib/membership"

interface SelectableClassroom extends AddPanelClassroomItem {
  isSelected: boolean
}

interface SelectableStudent extends AddPanelStudentItem {
  isSelected: boolean
}

interface UseStudentAddPanelParams {
  adapter: StudentAddPanelAdapter
  onAdded: () => void
  classroomActiveOnlyDefault: boolean
  studentActiveOnlyDefault: boolean
}

/** 学級候補が空になった理由（空表示メッセージの出し分け用） */
export type ClassroomEmptyReason =
  /** システムに生徒が1人も登録されていない（要・生徒登録） */
  | "noStudents"
  /** 生徒はいるが、どの学級にも所属していない */
  | "noClassroomMembership"
  /** 学級に所属者はいるが、在籍中（スイッチON条件）が0名 */
  | "noCurrentInClassroom"
  /** 学級に所属する生徒はいるが、追加可能分は全て追加済み */
  | "allAdded"

/** 生徒候補が空になった理由（空表示メッセージの出し分け用） */
export type StudentEmptyReason =
  /** システムに生徒が1人も登録されていない（要・生徒登録） */
  | "noStudents"
  /** 未在籍・在籍中（スイッチON条件）が0名で、過去在籍の生徒のみ存在 */
  | "noCurrentEnrollment"
  /** 対象生徒は存在するが、全て追加済み */
  | "allAdded"

/**
 * 学級候補が0件のときの理由を判定する。
 *
 * 対象スコープのアダプタ（未追加候補）だけでは「生徒0人」と「全員追加済み」を
 * 区別できないため、システム全体の生徒（追加済み含む）を見て判定する。
 */
async function resolveClassroomEmptyReason(
  adapter: StudentAddPanelAdapter,
  classroomActiveOnly: boolean
): Promise<ClassroomEmptyReason> {
  const allStudents = await window.electronAPI.fetchStudents()
  if (allStudents.length === 0) return "noStudents"
  const anyInClassroom = allStudents.some(
    (student) => student.memberships.length > 0
  )
  if (!anyInClassroom) return "noClassroomMembership"
  // 学級所属者はいる。未追加の学級候補（在籍条件なし）が残るかで切り分ける
  const classroomsAny = await adapter.fetchAvailableClassrooms(false)
  if (classroomActiveOnly && classroomsAny.length > 0)
    return "noCurrentInClassroom"
  return "allAdded"
}

/**
 * 生徒候補が0件のときの理由を判定する。
 *
 * システム全体の生徒（追加済み含む）を見て、「生徒0人」「全員追加済み」
 * 「未在籍・在籍中が元々0名（過去在籍のみ）」を区別する。
 */
async function resolveStudentEmptyReason(
  studentActiveOnly: boolean
): Promise<StudentEmptyReason> {
  const allStudents = await window.electronAPI.fetchStudents()
  if (allStudents.length === 0) return "noStudents"
  if (studentActiveOnly) {
    const hasCurrentOrUnassigned = allStudents.some(
      (student) =>
        student.memberships.length === 0 ||
        student.memberships.some(isCurrentMembership)
    )
    return hasCurrentOrUnassigned ? "allAdded" : "noCurrentEnrollment"
  }
  return "allAdded"
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
  classroomActiveOnlyDefault,
  studentActiveOnlyDefault,
}: UseStudentAddPanelParams) {
  const [activeTab, setActiveTab] = useState("classrooms")
  const [classrooms, setClassrooms] = useState<SelectableClassroom[]>([])
  const [students, setStudents] = useState<SelectableStudent[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [filterClassroomId, setFilterClassroomId] = useState("all")
  const [classroomActiveOnly, setClassroomActiveOnly] = useState(
    classroomActiveOnlyDefault
  )
  const [studentActiveOnly, setStudentActiveOnly] = useState(
    studentActiveOnlyDefault
  )
  const [loadingClassrooms, setLoadingClassrooms] = useState(false)
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [classroomEmptyReason, setClassroomEmptyReason] =
    useState<ClassroomEmptyReason | null>(null)
  const [studentEmptyReason, setStudentEmptyReason] =
    useState<StudentEmptyReason | null>(null)

  const loadClassrooms = useCallback(async () => {
    setLoadingClassrooms(true)
    try {
      const result = await adapter.fetchAvailableClassrooms(classroomActiveOnly)
      setClassrooms(
        result.map((classroom) => ({ ...classroom, isSelected: false }))
      )
      setClassroomEmptyReason(
        result.length > 0
          ? null
          : await resolveClassroomEmptyReason(adapter, classroomActiveOnly)
      )
    } catch (error) {
      console.error("Failed to fetch available classrooms:", error)
    } finally {
      setLoadingClassrooms(false)
    }
  }, [adapter, classroomActiveOnly])

  const loadStudents = useCallback(async () => {
    setLoadingStudents(true)
    try {
      const result = await adapter.fetchAvailableStudents(studentActiveOnly)
      setStudents(result.map((student) => ({ ...student, isSelected: false })))
      setStudentEmptyReason(
        result.length > 0
          ? null
          : await resolveStudentEmptyReason(studentActiveOnly)
      )
    } catch (error) {
      console.error("Failed to fetch available students:", error)
    } finally {
      setLoadingStudents(false)
    }
  }, [adapter, studentActiveOnly])

  useEffect(() => {
    loadClassrooms()
  }, [loadClassrooms])

  useEffect(() => {
    loadStudents()
  }, [loadStudents])

  const handleClassroomSelection = (
    classroomId: string,
    isSelected: boolean
  ) => {
    setClassrooms((prev) =>
      prev.map((classroom) =>
        classroom.id === classroomId ? { ...classroom, isSelected } : classroom
      )
    )
  }

  const handleClassroomReorder = (orderedIds: string[]) => {
    setClassrooms((prev) => {
      const byId = new Map(prev.map((classroom) => [classroom.id, classroom]))
      const reordered = orderedIds
        .map((id) => byId.get(id))
        .filter(
          (classroom): classroom is SelectableClassroom =>
            classroom !== undefined
        )
      // 並び替え対象（選択済み）以外はそのまま末尾に残す
      const rest = prev.filter(
        (classroom) => !orderedIds.includes(classroom.id)
      )
      return [...reordered, ...rest]
    })
  }

  const handleStudentSelection = (studentId: string, isSelected: boolean) => {
    setStudents((prev) =>
      prev.map((student) =>
        student.id === studentId ? { ...student, isSelected } : student
      )
    )
  }

  const handleAddClassrooms = async () => {
    const selected = classrooms.filter((classroom) => classroom.isSelected)
    if (selected.length === 0) return
    setIsAdding(true)
    try {
      await adapter.addClassrooms(
        selected.map((classroom) => classroom.id),
        classroomActiveOnly
      )
      await Promise.all([loadClassrooms(), loadStudents()])
      onAdded()
    } catch (error) {
      console.error("Failed to add classrooms:", error)
      alert(
        "学級の追加に失敗しました: " +
          (error instanceof Error ? error.message : "Unknown error")
      )
    } finally {
      setIsAdding(false)
    }
  }

  const handleAddStudents = async () => {
    const selected = students.filter((student) => student.isSelected)
    if (selected.length === 0) return
    setIsAdding(true)
    try {
      await adapter.addStudents(selected.map((student) => student.id))
      await Promise.all([loadClassrooms(), loadStudents()])
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
    const matchesClassroom =
      filterClassroomId === "all" ||
      student.memberships.some(
        (membership) => membership.classroom.id === filterClassroomId
      )
    return matchesSearch && matchesClassroom
  })

  const selectedClassrooms = classrooms.filter(
    (classroom) => classroom.isSelected
  )
  const selectedClassroomCount = selectedClassrooms.length
  const selectedStudentCount = students.filter(
    (student) => student.isSelected
  ).length

  return {
    activeTab,
    setActiveTab,
    classrooms,
    selectedClassrooms,
    students,
    filteredStudents,
    searchTerm,
    setSearchTerm,
    filterClassroomId,
    setFilterClassroomId,
    classroomActiveOnly,
    setClassroomActiveOnly,
    studentActiveOnly,
    setStudentActiveOnly,
    loadingClassrooms,
    loadingStudents,
    isAdding,
    classroomEmptyReason,
    studentEmptyReason,
    selectedClassroomCount,
    selectedStudentCount,
    handleClassroomSelection,
    handleClassroomReorder,
    handleStudentSelection,
    handleAddClassrooms,
    handleAddStudents,
  }
}
