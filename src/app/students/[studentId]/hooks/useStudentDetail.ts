import type { Student, StudentClassroomMembership } from "@prisma/client"
import { useRouter } from "next/navigation"

import { useClassrooms } from "@/hooks/useClassrooms"
import { useStudents } from "@/hooks/useStudents"
import type { StudentClassroomMembershipWithStudentAndClassroom } from "@/types/prismaExtensions"

export function useStudentDetail(studentId: string) {
  const router = useRouter()
  // 生徒・学級は全画面で共有するキャッシュから引く（この画面だけ取り直さない）
  const { students, isPending: studentsPending, refresh } = useStudents()
  const { classrooms, isPending: classroomsPending } = useClassrooms()
  const student = students.find((student) => student.id === studentId) ?? null
  const loading = studentsPending || classroomsPending

  const handleEditStudent = async (studentData: Partial<Student>) => {
    try {
      await window.electronAPI.updateStudent(studentId, studentData)
      await refresh()
      return true
    } catch (error) {
      console.error("Failed to update student:", error)
      alert("生徒情報の更新に失敗しました。")
      return false
    }
  }

  const handleDeleteStudent = async () => {
    if (
      window.confirm(
        "本当にこの生徒を削除しますか？\nこの操作は取り消すことができません。"
      )
    ) {
      try {
        await window.electronAPI.deleteStudent(studentId)
        router.push("/students")
        return true
      } catch (error) {
        console.error("Failed to delete student:", error)
        alert("生徒の削除に失敗しました。")
        return false
      }
    }
    return false
  }

  const handleSaveMembership = async (
    membershipData: Partial<StudentClassroomMembership> & {
      classroomId: string
    },
    membershipToEdit?: StudentClassroomMembershipWithStudentAndClassroom | null
  ) => {
    try {
      if (membershipToEdit) {
        await window.electronAPI.updateStudentClassroomMembership(
          membershipToEdit.id,
          membershipData
        )
      } else {
        const membership = await window.electronAPI.addStudentToClassroom(
          studentId,
          membershipData.classroomId,
          membershipData.startDate ?? undefined,
          membershipData.attendanceNumber ?? undefined,
          membershipData.notes ?? undefined
        )
        // 終了日が指定されている場合は所属を終了
        if (membershipData.endDate) {
          await window.electronAPI.endStudentMembership(
            membership.id,
            new Date(membershipData.endDate)
          )
        }
      }

      await refresh()
      return true
    } catch (error) {
      console.error("Failed to save membership:", error)
      alert("所属関係の保存に失敗しました。")
      return false
    }
  }

  const handleEndMembership = async (membershipId: string) => {
    if (window.confirm("この所属関係を終了しますか？")) {
      try {
        await window.electronAPI.endStudentMembership(membershipId)
        await refresh()
        return true
      } catch (error) {
        console.error("Failed to end membership:", error)
        alert("所属関係の終了に失敗しました。")
        return false
      }
    }
    return false
  }

  return {
    student,
    classrooms,
    loading,
    handleEditStudent,
    handleDeleteStudent,
    handleSaveMembership,
    handleEndMembership,
  }
}
