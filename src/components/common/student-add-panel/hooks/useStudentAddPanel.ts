"use client"

import type { Student } from "@prisma/client"
import type { QueryClient } from "@tanstack/react-query"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useMemo, useState } from "react"

import type {
  AddPanelClassroomCandidate,
  StudentAddPanelAdapter,
} from "@/components/common/student-add-panel/types"
import { isCurrentMembership } from "@/lib/membership"
import { queryKeys } from "@/lib/queryKeys"
import { studentListQuery } from "@/queries/student"
import type {
  ClassroomWithMemberships,
  StudentWithMemberships,
} from "@/types/prismaExtensions"

interface SelectableStudent extends StudentWithMemberships {
  isSelected: boolean
}

/**
 * この学級から追加できる生徒を集める。
 *
 * 在籍は学級の子として降ってくるが、同一生徒が複数の在籍歴を持つと同じ生徒が
 * 二度現れるので、studentId で畳む（既に対象へ追加済みの生徒は境界の where が外している）。
 */
function collectAddableStudents(
  classroom: ClassroomWithMemberships
): Student[] {
  const studentById = new Map<string, Student>()
  for (const membership of classroom.memberships) {
    if (studentById.has(membership.studentId)) continue
    studentById.set(membership.studentId, membership.student)
  }
  return [...studentById.values()]
}

interface UseStudentAddPanelParams {
  adapter: StudentAddPanelAdapter
  onAdded: () => void
  classroomActiveOnlyDefault: boolean
  studentActiveOnlyDefault: boolean
}

/** 学級候補が空になった理由（空表示メッセージの出し分け用） */
type ClassroomEmptyReason =
  /** システムに生徒が1人も登録されていない（要・生徒登録） */
  | "noStudents"
  /** 生徒はいるが、どの学級にも所属していない */
  | "noClassroomMembership"
  /** 学級に所属者はいるが、在籍中（スイッチON条件）が0名 */
  | "noCurrentInClassroom"
  /** 学級に所属する生徒はいるが、追加可能分は全て追加済み */
  | "allAdded"

/** 生徒候補が空になった理由（空表示メッセージの出し分け用） */
type StudentEmptyReason =
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
  queryClient: QueryClient,
  adapter: StudentAddPanelAdapter,
  classroomActiveOnly: boolean
): Promise<ClassroomEmptyReason> {
  const allStudents = await queryClient.fetchQuery(studentListQuery())
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
  queryClient: QueryClient,
  studentActiveOnly: boolean
): Promise<StudentEmptyReason> {
  const allStudents = await queryClient.fetchQuery(studentListQuery())
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
/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_CLASSROOMS: ClassroomWithMemberships[] = []
const EMPTY_STUDENTS: StudentWithMemberships[] = []

export function useStudentAddPanel({
  adapter,
  onAdded,
  classroomActiveOnlyDefault,
  studentActiveOnlyDefault,
}: UseStudentAddPanelParams) {
  const queryClient = useQueryClient()
  /** このパネル1つ分のクエリキー。同じ画面に2つ並んでも混ざらない */
  const scopeId = adapter.scopeId
  const [activeTab, setActiveTab] = useState("classrooms")
  /**
   * 選択は取得結果とは別に持つ。取得結果の配列に isSelected を混ぜると、
   * 再取得のたびに選択が消えるか、逆に消えた学級の選択が残る。
   *
   * id だけでなく**選んだ時点の学級の行**を控える。境界は追加できる生徒が0人の
   * 学級を候補に返さないので、在籍スイッチを入れると選んだ学級が候補から消える。
   * 行を持っていれば、消えても表示し続けられる（外せない選択を作らない）。
   * 選択そのものはこの Map の鍵で表す。
   */
  const [selectedClassroomById, setSelectedClassroomById] = useState<
    Map<string, ClassroomWithMemberships>
  >(new Map())
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(
    new Set()
  )
  /** 選択した順の学級id。追加順が採番の順序になるので保つ */
  const [classroomOrder, setClassroomOrder] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [filterClassroomId, setFilterClassroomId] = useState("all")
  const [classroomActiveOnly, setClassroomActiveOnly] = useState(
    classroomActiveOnlyDefault
  )
  const [studentActiveOnly, setStudentActiveOnly] = useState(
    studentActiveOnlyDefault
  )
  const [isAdding, setIsAdding] = useState(false)

  // 候補が空のときの理由（学級が1つも無いのか、全部登録済みなのか）は
  // 空だったときだけ引く。候補と対で表示するので同じ取得にまとめる
  const classroomsKey = useMemo(
    () => queryKeys.roster.addPanelClassrooms(scopeId, classroomActiveOnly),
    [scopeId, classroomActiveOnly]
  )
  const { data: classroomData, isFetching: loadingClassrooms } = useQuery({
    queryKey: classroomsKey,
    queryFn: async () => {
      const classrooms =
        await adapter.fetchAvailableClassrooms(classroomActiveOnly)
      return {
        classrooms,
        emptyReason:
          classrooms.length > 0
            ? null
            : await resolveClassroomEmptyReason(
                queryClient,
                adapter,
                classroomActiveOnly
              ),
      }
    },
  })
  const availableClassrooms = classroomData?.classrooms ?? EMPTY_CLASSROOMS
  const classroomEmptyReason = classroomData?.emptyReason ?? null

  const studentsKey = useMemo(
    () => queryKeys.roster.addPanelStudents(scopeId, studentActiveOnly),
    [scopeId, studentActiveOnly]
  )
  const { data: studentData, isFetching: loadingStudents } = useQuery({
    queryKey: studentsKey,
    queryFn: async () => {
      const students = await adapter.fetchAvailableStudents(studentActiveOnly)
      return {
        students,
        emptyReason:
          students.length > 0
            ? null
            : await resolveStudentEmptyReason(queryClient, studentActiveOnly),
      }
    },
  })
  const availableStudents = studentData?.students ?? EMPTY_STUDENTS
  const studentEmptyReason = studentData?.emptyReason ?? null

  const loadClassrooms = useCallback(
    () => queryClient.invalidateQueries({ queryKey: classroomsKey }),
    [queryClient, classroomsKey]
  )
  const loadStudents = useCallback(
    () => queryClient.invalidateQueries({ queryKey: studentsKey }),
    [queryClient, studentsKey]
  )

  // 表示用に「取得結果 × 選択」を組み立てる。選択した順を先頭へ寄せる
  const classrooms = useMemo<AddPanelClassroomCandidate[]>(() => {
    const availableIds = new Set(
      availableClassrooms.map((classroom) => classroom.id)
    )
    const candidates = availableClassrooms.map((classroom) => ({
      classroom,
      addableStudents: collectAddableStudents(classroom),
      isSelected: selectedClassroomById.has(classroom.id),
    }))
    // 候補から消えた選択済みの学級も、チェックが付いている間は出し続ける。
    // 消えたのは「追加できる生徒が0人」だからなので、人数は選んだ時点の数字では
    // なく 0名 と出す（38名と出したまま追加すると0人しか入らない）
    for (const [classroomId, classroom] of selectedClassroomById) {
      if (availableIds.has(classroomId)) continue
      candidates.push({ classroom, addableStudents: [], isSelected: true })
    }
    const orderIndex = new Map(
      classroomOrder.map((classroomId, index) => [classroomId, index])
    )
    return candidates.sort(
      (left, right) =>
        (orderIndex.get(left.classroom.id) ?? Number.MAX_SAFE_INTEGER) -
        (orderIndex.get(right.classroom.id) ?? Number.MAX_SAFE_INTEGER)
    )
  }, [availableClassrooms, selectedClassroomById, classroomOrder])

  const students = useMemo<SelectableStudent[]>(
    () =>
      availableStudents.map((student) => ({
        ...student,
        isSelected: selectedStudentIds.has(student.id),
      })),
    [availableStudents, selectedStudentIds]
  )

  const handleClassroomSelection = (
    classroomId: string,
    isSelected: boolean
  ) => {
    // チェックを付けた時点の行を控える（候補から消えても表示し続けるため）。
    // 既に候補から消えている学級を付け直すことはない（外した瞬間に消えるので）
    const selectedClassroom = availableClassrooms.find(
      (classroom) => classroom.id === classroomId
    )
    setSelectedClassroomById((prev) => {
      const next = new Map(prev)
      if (!isSelected) next.delete(classroomId)
      else if (selectedClassroom) next.set(classroomId, selectedClassroom)
      return next
    })
  }

  const handleClassroomReorder = (orderedIds: string[]) => {
    setClassroomOrder(orderedIds)
  }

  const handleStudentSelection = (studentId: string, isSelected: boolean) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev)
      if (isSelected) next.add(studentId)
      else next.delete(studentId)
      return next
    })
  }

  const handleAddClassrooms = async () => {
    const selected = classrooms.filter((candidate) => candidate.isSelected)
    if (selected.length === 0) return
    setIsAdding(true)
    try {
      await adapter.addClassrooms(
        selected.map((candidate) => candidate.classroom.id),
        classroomActiveOnly
      )
      setSelectedClassroomById(new Map())
      setClassroomOrder([])
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
      setSelectedStudentIds(new Set())
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
    (candidate) => candidate.isSelected
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
