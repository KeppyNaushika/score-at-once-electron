"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useMemo, useState } from "react"

import type { RosterClassroomOption } from "@/components/common/roster-table"
import {
  type ExamClassroomPlacement,
  resolveExamClassroomPlacement,
} from "@/lib/examClassroomPlacement"
import {
  checkGradingDataForStudentsMutation,
  examStudentsQuery,
  removeStudentsFromExamMutation,
  updateExamStudentOrdersMutation,
  updateStudentExamStatusMutation,
} from "@/queries/exam"
import { administeredExamClassroomsQuery } from "@/queries/examClassroom"
import type { ExamStudentStatus } from "@/types/examStudentStatus.types"
import type { ExamStudentWithMemberships } from "@/types/prismaExtensions"

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_EXAM_STUDENTS: ExamStudentWithMemberships[] = []

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
  const queryClient = useQueryClient()
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

  const {
    data: examStudentRows = EMPTY_EXAM_STUDENTS,
    isPending: examStudentsPending,
  } = useQuery(examStudentsQuery(examId))
  const {
    data: administeredClassrooms,
    isPending: administeredClassroomsPending,
  } = useQuery(administeredExamClassroomsQuery(examId))

  const updateStudentExamStatus = useMutation(
    updateStudentExamStatusMutation(examId)
  )
  const updateExamStudentOrders = useMutation(
    updateExamStudentOrdersMutation(examId)
  )
  const removeStudentsFromExam = useMutation(
    removeStudentsFromExamMutation(examId)
  )
  const checkGradingDataForStudents = useMutation(
    checkGradingDataForStudentsMutation(examId)
  )

  const loading = examStudentsPending || administeredClassroomsPending

  // 採番学級は administered 学級（DB 構造）から renderer 側で解決する。
  // ExamStudentWithMemberships にはマージせず studentId をキーに別持ちする side data
  const placementByStudent = useMemo(
    () => resolveExamClassroomPlacement(administeredClassrooms ?? []),
    [administeredClassrooms]
  )

  // 受験生徒を customOrder 順で並び替え（ExamStudent テーブルの順序が基準）
  const examStudents = useMemo(
    () => [...examStudentRows].sort(compareExamStudents(placementByStudent)),
    [examStudentRows, placementByStudent]
  )

  // フィルタ用学級リスト: 受験生徒の所属履歴から抽出（id/name のみ）
  const classrooms = useMemo<RosterClassroomOption[]>(() => {
    const uniqueClasses = new Map<string, RosterClassroomOption>()
    for (const examStudent of examStudents) {
      for (const membership of examStudent.student.memberships ?? []) {
        if (uniqueClasses.has(membership.classroom.id)) continue
        uniqueClasses.set(membership.classroom.id, {
          id: membership.classroom.id,
          name: membership.classroom.name,
        })
      }
    }
    return Array.from(uniqueClasses.values())
  }, [examStudents])

  const refreshStudentData = useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: examStudentsQuery(examId).queryKey,
      }),
    [examId, queryClient]
  )

  // 生徒の状態を更新
  const updateStudentStatus = (
    studentId: string,
    newStatus: ExamStudentStatus
  ) => {
    updateStudentExamStatus.mutate({ studentId, status: newStatus })
  }

  /**
   * 生徒の並び順を更新する。
   *
   * 掴んだ手に追従させるため、先にキャッシュへ置いてから書く（取り直しを待つと
   * 行が元の位置へ戻って見える）。
   */
  const updateStudentOrders = (
    _examId: string,
    studentOrders: { studentId: string; customOrder: number }[]
  ) => {
    const orderByStudentId = new Map(
      studentOrders.map((studentOrder) => [
        studentOrder.studentId,
        studentOrder.customOrder,
      ])
    )
    queryClient.setQueryData(examStudentsQuery(examId).queryKey, (cached) =>
      cached?.map((examStudent) => ({
        ...examStudent,
        customOrder:
          orderByStudentId.get(examStudent.studentId) ??
          examStudent.customOrder,
      }))
    )
    updateExamStudentOrders.mutate(studentOrders)
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

    // 採点データの存在を確認。読めなくても削除の確認自体は出す
    try {
      const gradingData =
        await checkGradingDataForStudents.mutateAsync(studentIds)
      setGradingItemCount(gradingData.totalGradingItems)
    } catch {
      setGradingItemCount(0)
    }

    setShowRemovalConfirm(true)
  }

  // 生徒削除の確定実行
  const confirmStudentRemoval = () => {
    removeStudentsFromExam.mutate(studentsToRemove, {
      onSuccess: () => {
        setSelectedStudentsForRemoval(new Set())
        setStudentsToRemove([])
        setShowRemovalConfirm(false)
      },
    })
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
