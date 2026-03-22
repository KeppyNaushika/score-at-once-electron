"use client"

import type { Prisma } from "@prisma/client"
import { useCallback, useEffect, useState } from "react"

import type {
  ClassWithMemberships,
  StudentWithMemberships,
} from "@/types/prismaExtensions"

/** 所属関係情報（UI用 — 新規作成時のstudentId指定を含む） */
interface Membership {
  id: string
  startDate: Date
  endDate?: Date | null
  attendanceNumber?: number | null
  notes?: string | null
  studentId?: string // 新規作成時に使用
  student: {
    id: string
    studentNumber: string
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

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const classes = await window.electronAPI.fetchClasses()
      const targetClass = classes.find((c) => c.id === classId)
      if (targetClass) {
        setClassData(targetClass)
      }

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
      setClassData(updatedClass)
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
        setClassData(updatedClass)
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
          setClassData(updatedClass)
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
        setClassData(updatedClass)
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

export type { Membership }
