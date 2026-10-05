import { useMemo } from "react"

import { useTableSort } from "@/hooks/useTableSort"
import { MEMBERSHIP_PHASE_LABELS, membershipPhase } from "@/lib/membership"
import {
  classroomFilterOptions,
  studentSearchTerms,
} from "@/lib/searchKeywords"
import { matchesSearchTerm } from "@/lib/searchText"
import type {
  ClassroomWithMemberships,
  StudentWithMemberships,
} from "@/types/prismaExtensions"

/** 生徒の所属状況。絞り込みはこの中から複数を選び、どれかに当てはまる生徒を出す */
export const STUDENT_MEMBERSHIP_STATUSES = [
  "unassigned",
  "current",
  "upcoming",
  "past",
] as const

export type StudentMembershipStatus =
  (typeof STUDENT_MEMBERSHIP_STATUSES)[number]

export const STUDENT_MEMBERSHIP_STATUS_LABELS: Record<
  StudentMembershipStatus,
  string
> = {
  unassigned: "未在籍",
  ...MEMBERSHIP_PHASE_LABELS,
}

/**
 * 既定で出す所属状況。過去在籍だけの生徒（卒業・転出）を除き、在籍予定は含める
 * （新年度の学級を前もって組んだ生徒が、登録したはずなのに見つからなくならないよう）
 */
export const DEFAULT_STUDENT_MEMBERSHIP_STATUSES: ReadonlySet<StudentMembershipStatus> =
  new Set(["unassigned", "current", "upcoming"])

/** 並べ替えの鍵を持った1行 */
interface StudentSortable {
  id: string
  studentNumber: string
  fullName: string
  enrollmentYear: number | null
  original: StudentWithMemberships
}

interface StudentTableFilters {
  students: StudentWithMemberships[]
  classrooms: ClassroomWithMemberships[]
  searchTerm: string
  /** 所属したことのある学級で絞る（"all" で絞らない） */
  classroomId: string
  /** 出す所属状況。どれかに当てはまる生徒を出す */
  membershipStatuses: ReadonlySet<StudentMembershipStatus>
}

/**
 * 生徒の所属状況。所属が無ければ未在籍、今日在籍している所属があれば在籍中、開始日が
 * まだ来ていない所属があれば在籍予定（在籍中と在籍予定は両方当てはまりうる）、所属が
 * 終わったものしか無ければ過去在籍
 */
function studentMembershipStatuses(
  student: StudentWithMemberships
): Set<StudentMembershipStatus> {
  if (student.memberships.length === 0) return new Set(["unassigned"])
  const phases = new Set(
    student.memberships.map((membership) => membershipPhase(membership))
  )
  const statuses = new Set<StudentMembershipStatus>()
  if (phases.has("current")) statuses.add("current")
  if (phases.has("upcoming")) statuses.add("upcoming")
  if (statuses.size === 0) statuses.add("past")
  return statuses
}

/**
 * 生徒管理の一覧の行（絞り込み・並べ替え済み）と、学級の絞り込みの選択肢。
 */
export function useStudentTableRows({
  students,
  classrooms,
  searchTerm,
  classroomId,
  membershipStatuses,
}: StudentTableFilters) {
  const filteredStudents = useMemo(
    () =>
      students.filter(
        (student) =>
          matchesSearchTerm(searchTerm, studentSearchTerms(student)) &&
          // 学級は「その学級に所属したことがあるか」で絞る。在籍中に限ると、
          // 前年度の学級を選んだときに誰も出なくなる（在籍中かは所属状況のほうで問う）
          (classroomId === "all" ||
            student.memberships.some(
              (membership) => membership.classroom.id === classroomId
            )) &&
          [...studentMembershipStatuses(student)].some((status) =>
            membershipStatuses.has(status)
          )
      ),
    [students, searchTerm, classroomId, membershipStatuses]
  )

  const classroomOptions = useMemo(
    () =>
      // 非表示の学級も選べるようにする。前年度の学級はたいてい非表示にされており、
      // 外すと過去の所属で絞り込めない。表示中を先に並べる
      classroomFilterOptions(
        classrooms.toSorted(
          (classroomA, classroomB) =>
            Number(classroomA.isVisible === false) -
              Number(classroomB.isVisible === false) ||
            classroomA.name.localeCompare(classroomB.name)
        )
      ),
    [classrooms]
  )

  const sortableData = useMemo<StudentSortable[]>(
    () =>
      filteredStudents.map((student) => ({
        id: student.id,
        studentNumber: student.studentNumber,
        fullName: `${student.lastName}${student.firstName}`,
        enrollmentYear: student.enrollmentYear ?? null,
        original: student,
      })),
    [filteredStudents]
  )

  const { sortedData, sortConfig, requestSort } = useTableSort(sortableData, {
    defaultSort: { key: "fullName", direction: "asc" },
  })

  return { sortedData, sortConfig, requestSort, classroomOptions }
}
