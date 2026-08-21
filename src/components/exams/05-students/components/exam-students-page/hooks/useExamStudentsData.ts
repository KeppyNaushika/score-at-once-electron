"use client"

import type { Classroom } from "@prisma/client"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useMemo, useState } from "react"

import { useConfirmedDeletion } from "@/hooks/useConfirmedDeletion"
import {
  type ExamClassroomPlacement,
  resolveExamClassroomPlacement,
} from "@/lib/examClassroomPlacement"
import {
  examStudentDeletionCountsMutation,
  examStudentsQuery,
  removeStudentsFromExamMutation,
  updateExamStudentOrdersMutation,
  updateStudentExamStatusMutation,
} from "@/queries/exam"
import { administeredExamClassroomsQuery } from "@/queries/examClassroom"
import type { ConfirmedDeletionCount } from "@/types/deletionConfirmation.types"
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
  // 削除確認で見せている件数。数え終わるまでと、数えられなかったときは null
  // （見ていない件数は添えようがないので、そのまま押させない）
  const [removalDeletionCounts, setRemovalDeletionCounts] = useState<
    ConfirmedDeletionCount[] | null
  >(null)

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
  const countExamStudentDeletion = useMutation(
    examStudentDeletionCountsMutation(examId)
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

  // フィルタ用学級リスト: 受験生徒の所属履歴に現れる Classroom を id で一意化する
  const classrooms = useMemo<Classroom[]>(() => {
    const classroomById = new Map<string, Classroom>()
    for (const examStudent of examStudents) {
      for (const membership of examStudent.student.memberships ?? []) {
        if (classroomById.has(membership.classroom.id)) continue
        classroomById.set(membership.classroom.id, membership.classroom)
      }
    }
    return Array.from(classroomById.values())
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

  // 離した時点で書き、書けても書けなくても読み直す。表示側（useRosterTable）は
  // これが解決した時点で手元の並びを捨てるので、**読み直しまで待ってから解決する**。
  // 失敗の知らせは中央のトースト（queries/queryClient.ts）が出す
  const updateStudentOrders = async (
    _examId: string,
    studentOrders: { studentId: string; customOrder: number }[]
  ) => {
    try {
      await updateExamStudentOrders.mutateAsync(studentOrders)
    } catch (error) {
      // ここで握るのは、dnd-kit の onDragEnd が Promise を受け取らないため
      console.error("Failed to update student orders:", error)
    } finally {
      await refreshStudentData()
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

  // 巻き添えになる採点データを数える。数えられなければ null のまま
  // （0 を入れると「採点データがないため安全に削除できます」と嘘をつく）
  const countRemovalImpact = useCallback(
    async (studentIds: string[]) => {
      setRemovalDeletionCounts(null)
      try {
        setRemovalDeletionCounts(
          await countExamStudentDeletion.mutateAsync(studentIds)
        )
      } catch {
        // 失敗の知らせは中央のトーストが出す。件数不明のまま押させない
      }
    },
    [countExamStudentDeletion]
  )

  // 選択した生徒の削除開始
  const initiateStudentRemoval = async () => {
    if (selectedStudentsForRemoval.size === 0) return

    const studentIds = Array.from(selectedStudentsForRemoval)
    setStudentsToRemove(studentIds)
    setShowRemovalConfirm(true)
    await countRemovalImpact(studentIds)
  }

  // 生徒削除の確定実行。見せた件数を添え、中止されたら開いたまま数え直す（段階26）
  const {
    canConfirm: canConfirmStudentRemoval,
    refusalMessage: studentRemovalRefusalMessage,
    confirmDeletion,
  } = useConfirmedDeletion({
    confirmedCounts: removalDeletionCounts,
    deleteWithConfirmedCounts: useCallback(
      async (confirmedCounts: ConfirmedDeletionCount[]) => {
        await removeStudentsFromExam.mutateAsync({
          studentIds: studentsToRemove,
          confirmedCounts,
        })
      },
      [removeStudentsFromExam, studentsToRemove]
    ),
    recount: useCallback(
      () => countRemovalImpact(studentsToRemove),
      [countRemovalImpact, studentsToRemove]
    ),
  })

  const confirmStudentRemoval = async () => {
    if (!(await confirmDeletion())) return
    setSelectedStudentsForRemoval(new Set())
    setStudentsToRemove([])
    setShowRemovalConfirm(false)
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
    removalDeletionCounts,
    canConfirmStudentRemoval,
    studentRemovalRefusalMessage,
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
