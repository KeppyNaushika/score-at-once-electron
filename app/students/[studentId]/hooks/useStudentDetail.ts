import {
  ClassWithMemberships,
  Membership,
  StudentWithMemberships,
} from "@/app/students/[studentId]/types"
import type { Student, StudentClassMembership } from "@prisma/client"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

export function useStudentDetail(studentId: string) {
  const router = useRouter()
  const [student, setStudent] = useState<StudentWithMemberships | null>(null)
  const [classes, setClasses] = useState<ClassWithMemberships[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        // Fetch all students and find the one we need
        const students = await window.electronAPI.fetchStudents()
        const targetStudent = students.find((s) => s.id === studentId)
        if (targetStudent) {
          // Transform the student data to match the expected interface
          const transformedStudent = {
            ...targetStudent,
            memberships: targetStudent.memberships.map(
              (
                membership: StudentClassMembership & {
                  class: {
                    id: string
                    name: string
                    grade?: number | null
                    classCode?: string | null
                  }
                }
              ) => ({
                ...membership,
                startDate: new Date(
                  membership.startDate || membership.createdAt
                ),
                endDate: membership.endDate
                  ? new Date(membership.endDate)
                  : null,
              })
            ),
          }
          setStudent(transformedStudent)
        }

        // Fetch all classes for membership management
        const fetchedClasses = await window.electronAPI.fetchClasses()
        setClasses(fetchedClasses || [])
      } catch (error) {
        console.error("Failed to fetch data:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [studentId])

  const handleEditStudent = async (studentData: Partial<Student>) => {
    try {
      const updatedStudent = await window.electronAPI.updateStudent(
        studentId,
        studentData
      )
      // Transform the updated student data to match the expected interface
      const transformedStudent = {
        ...updatedStudent,
        memberships:
          updatedStudent.memberships?.map(
            (
              membership: StudentClassMembership & {
                class: {
                  id: string
                  name: string
                  grade?: number | null
                  classCode?: string | null
                }
              }
            ) => ({
              ...membership,
              startDate: new Date(membership.startDate || membership.createdAt),
              endDate: membership.endDate ? new Date(membership.endDate) : null,
            })
          ) || [],
      }
      setStudent(transformedStudent)
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
    membershipData: Partial<StudentClassMembership> & { classId: string },
    membershipToEdit?: Membership | null
  ) => {
    try {
      if (membershipToEdit) {
        await window.electronAPI.updateStudentClassMembership(
          membershipToEdit.id,
          membershipData
        )
      } else {
        await window.electronAPI.addStudentToClass(
          studentId,
          membershipData.classId
        )
      }

      // Refresh student data
      const students = await window.electronAPI.fetchStudents()
      const updatedStudent = students.find((s) => s.id === studentId)
      if (updatedStudent) {
        // Transform the updated student data to match the expected interface
        const transformedStudent = {
          ...updatedStudent,
          memberships:
            updatedStudent.memberships?.map(
              (
                membership: StudentClassMembership & {
                  class: {
                    id: string
                    name: string
                    grade?: number | null
                    classCode?: string | null
                  }
                }
              ) => ({
                ...membership,
                startDate: new Date(
                  membership.startDate || membership.createdAt
                ),
                endDate: membership.endDate
                  ? new Date(membership.endDate)
                  : null,
              })
            ) || [],
        }
        setStudent(transformedStudent)
      }
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

        // Refresh student data
        const students = await window.electronAPI.fetchStudents()
        const updatedStudent = students.find((s) => s.id === studentId)
        if (updatedStudent) {
          // Transform the updated student data to match the expected interface
          const transformedStudent = {
            ...updatedStudent,
            memberships:
              updatedStudent.memberships?.map(
                (
                  membership: StudentClassMembership & {
                    class: {
                      id: string
                      name: string
                      grade?: number | null
                      classCode?: string | null
                    }
                  }
                ) => ({
                  ...membership,
                  startDate: new Date(
                    membership.startDate || membership.createdAt
                  ),
                  endDate: membership.endDate
                    ? new Date(membership.endDate)
                    : null,
                })
              ) || [],
          }
          setStudent(transformedStudent)
        }
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
    classes,
    loading,
    handleEditStudent,
    handleDeleteStudent,
    handleSaveMembership,
    handleEndMembership,
  }
}
