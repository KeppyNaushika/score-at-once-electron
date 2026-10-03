import type { Student, StudentClassroomMembership } from "@prisma/client"
import { useMutation, useQuery } from "@tanstack/react-query"

import { useDialogTarget } from "@/hooks/useDialogTarget"
import {
  addStudentToClassroomMutation,
  classroomListQuery,
  endStudentMembershipMutation,
  studentListQuery,
  updateStudentMembershipMutation,
  updateStudentMutation,
} from "@/queries/student"
import type { ClassroomWithMemberships } from "@/types/prismaExtensions"
import type { StudentWithMemberships } from "@/types/prismaExtensions"
import type { StudentClassroomMembershipWithStudentAndClassroom } from "@/types/prismaExtensions"

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_STUDENTS: StudentWithMemberships[] = []

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_CLASSROOMS: ClassroomWithMemberships[] = []

export function useStudentDetail(studentId: string) {
  // 生徒・学級は全画面で共有するキャッシュから引く（この画面だけ取り直さない）
  const { data: students = EMPTY_STUDENTS, isPending: studentsPending } =
    useQuery(studentListQuery())
  const { data: classrooms = EMPTY_CLASSROOMS, isPending: classroomsPending } =
    useQuery(classroomListQuery())
  const student = students.find((student) => student.id === studentId) ?? null
  const loading = studentsPending || classroomsPending

  // 失敗の通知も取り直しも `MutationCache` が持つ。ここが返す真偽は
  // 「モーダルを閉じてよいか」だけを言う
  const updateStudent = useMutation(updateStudentMutation())
  const addMembership = useMutation(addStudentToClassroomMutation())
  const updateMembership = useMutation(updateStudentMembershipMutation())
  const endMembership = useMutation(endStudentMembershipMutation())

  const handleEditStudent = async (studentData: Partial<Student>) => {
    try {
      await updateStudent.mutateAsync({ id: studentId, student: studentData })
      return true
    } catch {
      return false
    }
  }

  const handleSaveMembership = async (
    membershipData: Partial<StudentClassroomMembership> & {
      classroomId: string
    },
    membershipToEdit?: StudentClassroomMembershipWithStudentAndClassroom | null
  ) => {
    try {
      if (membershipToEdit) {
        await updateMembership.mutateAsync({
          id: membershipToEdit.id,
          membership: membershipData,
        })
      } else {
        const membership = await addMembership.mutateAsync({
          studentId,
          classroomId: membershipData.classroomId,
          startDate: membershipData.startDate ?? undefined,
          attendanceNumber: membershipData.attendanceNumber ?? undefined,
          notes: membershipData.notes ?? undefined,
        })
        // 終了日が指定されている場合は所属を終了
        if (membershipData.endDate) {
          await endMembership.mutateAsync({
            membershipId: membership.id,
            endDate: new Date(membershipData.endDate),
          })
        }
      }
      return true
    } catch {
      return false
    }
  }

  // 終了は確認の窓を通してから。窓は呼び出し側で描く
  const membershipEnding = useDialogTarget<string>()

  const handleConfirmEndMembership = () => {
    if (membershipEnding.target === null) return
    endMembership.mutate({ membershipId: membershipEnding.target })
    membershipEnding.close()
  }

  return {
    student,
    classrooms,
    loading,
    handleEditStudent,
    handleSaveMembership,
    membershipEnding,
    handleConfirmEndMembership,
  }
}
