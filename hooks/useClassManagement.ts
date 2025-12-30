"use client"

import type { Prisma } from "@prisma/client"
import { useCallback, useEffect, useState } from "react"

/** 生徒情報（membershipsなし） */
interface StudentWithMemberships {
  id: string
  studentId: string
  lastName: string
  firstName: string
  lastNameKana: string
  firstNameKana: string
  enrollmentYear?: number | null
}

/** 学級情報（memberships含む） */
interface ClassWithMemberships {
  id: string
  name: string
  classCode?: string | null
  grade?: number | null
  description?: string | null
  isVisible?: boolean
  memberships: Membership[]
}

/** 所属関係情報 */
interface Membership {
  id: string
  startDate: Date
  endDate?: Date | null
  attendanceNumber?: number | null
  notes?: string | null
  studentId?: string // 新規作成時に使用
  student: {
    id: string
    studentId: string
    lastName: string
    firstName: string
    firstNameKana: string
  }
}

/** IPC経由で受け取る生の所属関係データ（Dateがstringでシリアライズされている） */
interface RawMembership {
  id: string
  studentId: string
  classId: string
  startDate: string | Date
  endDate?: string | Date | null
  attendanceNumber?: number | null
  notes?: string | null
  createdAt?: string | Date
  student: {
    id: string
    studentId: string
    lastName: string
    firstName: string
    firstNameKana: string
  }
}

export function useClassManagement(classId: string) {
  const [loading, setLoading] = useState(true)
  const [classData, setClassData] = useState<ClassWithMemberships | null>(null)
  const [students, setStudents] = useState<StudentWithMemberships[]>([])
  const [isClassModalOpen, setIsClassModalOpen] = useState(false)
  const [isStudentImportModalOpen, setIsStudentImportModalOpen] =
    useState(false)
  const [isMembershipModalOpen, setIsMembershipModalOpen] = useState(false)
  const [membershipToEdit, setMembershipToEdit] = useState<Membership | null>(
    null
  )

  /** APIレスポンスをUI用の型に変換 */
  const transformClassData = (
    rawClassData: Omit<ClassWithMemberships, "memberships"> & {
      memberships: RawMembership[]
    }
  ): ClassWithMemberships => ({
    ...rawClassData,
    memberships:
      rawClassData.memberships?.map((membership) => ({
        id: membership.id,
        startDate: new Date(
          membership.startDate || membership.createdAt || new Date()
        ),
        endDate: membership.endDate ? new Date(membership.endDate) : null,
        attendanceNumber: membership.attendanceNumber,
        notes: membership.notes,
        studentId: membership.studentId,
        student: membership.student,
      })) || [],
  })

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      // Fetch all classes and find the one we need
      const classes = await window.electronAPI.fetchClasses()
      const targetClass = classes.find((c) => c.id === classId)
      if (targetClass) {
        setClassData(transformClassData(targetClass))
      }

      // Fetch all students for membership management
      const fetchedStudents = await window.electronAPI.fetchStudents()
      setStudents(fetchedStudents || [])
    } catch (error) {
      console.error("Failed to fetch data:", error)
    } finally {
      setLoading(false)
    }
  }, [classId])

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void fetchData()
    })

    return () => cancelAnimationFrame(frame)
  }, [fetchData])

  const handleSaveClass = async (classInfo: Partial<ClassWithMemberships>) => {
    try {
      // Extract memberships to avoid type conflicts
      const { memberships: _memberships, ...classUpdateData } = classInfo
      const updateInput: Prisma.ClassUpdateInput & { id: string } = {
        id: classId,
        name: classUpdateData.name,
        classCode: classUpdateData.classCode,
        grade: classUpdateData.grade,
        description: classUpdateData.description,
        isVisible: classUpdateData.isVisible,
      }
      const updatedClass = await window.electronAPI.updateClass(updateInput)
      setClassData(transformClassData(updatedClass))
      setIsClassModalOpen(false)
    } catch (error) {
      console.error("Failed to update class:", error)
      alert("学級情報の更新に失敗しました。")
    }
  }

  const handleStudentImportSuccess = async () => {
    // Refresh class data
    await fetchData()
    setIsStudentImportModalOpen(false)
  }

  const handleSaveMembership = async (membershipData: Partial<Membership>) => {
    try {
      if (membershipToEdit) {
        // 既存のmembershipを更新
        const updateInput: Prisma.StudentClassMembershipUpdateInput = {
          attendanceNumber: membershipData.attendanceNumber,
          notes: membershipData.notes,
          startDate: membershipData.startDate,
          endDate: membershipData.endDate,
        }
        await window.electronAPI.updateStudentClassMembership(
          membershipToEdit.id,
          updateInput
        )
      } else if (membershipData.studentId) {
        // 新規所属関係を作成
        await window.electronAPI.addStudentToClass(
          membershipData.studentId,
          classId
        )
      }

      // Refresh class data
      const classes = await window.electronAPI.fetchClasses()
      const updatedClass = classes.find((c) => c.id === classId)
      if (updatedClass) {
        setClassData(transformClassData(updatedClass))
      }
      setIsMembershipModalOpen(false)
    } catch (error) {
      console.error("Failed to save membership:", error)
      alert("所属関係の保存に失敗しました。")
    }
  }

  const handleDeleteMembership = async (membershipId: string) => {
    if (window.confirm("この所属関係を削除しますか？")) {
      try {
        await window.electronAPI.deleteStudentClassMembership(membershipId)

        // Refresh class data
        const classes = await window.electronAPI.fetchClasses()
        const updatedClass = classes.find((c) => c.id === classId)
        if (updatedClass) {
          setClassData(transformClassData(updatedClass))
        }
      } catch (error) {
        console.error("Failed to delete membership:", error)
        alert("所属関係の削除に失敗しました。")
      }
    }
  }

  const handleBulkDeleteMemberships = async (membershipIds: string[]) => {
    try {
      // Delete each membership
      for (const membershipId of membershipIds) {
        await window.electronAPI.deleteStudentClassMembership(membershipId)
      }

      // Refresh class data
      const classes = await window.electronAPI.fetchClasses()
      const updatedClass = classes.find((c) => c.id === classId)
      if (updatedClass) {
        setClassData(transformClassData(updatedClass))
      }
    } catch (error) {
      console.error("Failed to delete memberships:", error)
      alert("所属関係の削除に失敗しました。")
    }
  }

  const handleDeleteClass = async () => {
    if (window.confirm("この学級を削除しますか？")) {
      try {
        await window.electronAPI.deleteClass(classId)
        // Navigate back to classes list would be handled by the component
      } catch (error) {
        console.error("Failed to delete class:", error)
        alert("学級の削除に失敗しました。")
      }
    }
  }

  return {
    loading,
    classData,
    students,
    isClassModalOpen,
    setIsClassModalOpen,
    isStudentImportModalOpen,
    setIsStudentImportModalOpen,
    isMembershipModalOpen,
    setIsMembershipModalOpen,
    setMembershipToEdit,
    handleSaveClass,
    handleStudentImportSuccess,
    handleSaveMembership,
    handleDeleteMembership,
    handleBulkDeleteMemberships,
    handleDeleteClass,
  }
}

export type { ClassWithMemberships, Membership, StudentWithMemberships }
