import { useMemo } from "react"

import { useTableSort } from "@/hooks/useTableSort"
import { isCurrentMembership } from "@/lib/membership"
import {
  classroomFilterOptions,
  studentSearchTerms,
} from "@/lib/searchKeywords"
import { matchesSearchTerm } from "@/lib/searchText"
import type {
  ClassroomWithMemberships,
  StudentWithMemberships,
} from "@/types/prismaExtensions"

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
  /** 所属状況（"all" / "unassigned" / "current" / "current_unassigned" / "past"） */
  membershipStatus: string
}

/** 所属状況の絞り込みに合うか */
function matchesMembershipStatus(
  student: StudentWithMemberships,
  membershipStatus: string
): boolean {
  const hasCurrentMembership = student.memberships.some((membership) =>
    isCurrentMembership(membership)
  )
  switch (membershipStatus) {
    case "current_unassigned":
      return student.memberships.length === 0 || hasCurrentMembership
    case "current":
      return hasCurrentMembership
    case "past":
      return student.memberships.length > 0 && !hasCurrentMembership
    case "unassigned":
      return student.memberships.length === 0
    default:
      return true
  }
}

/**
 * 生徒管理の一覧の行（絞り込み・並べ替え済み）と、学級の絞り込みの選択肢。
 */
export function useStudentTableRows({
  students,
  classrooms,
  searchTerm,
  classroomId,
  membershipStatus,
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
          matchesMembershipStatus(student, membershipStatus)
      ),
    [students, searchTerm, classroomId, membershipStatus]
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
