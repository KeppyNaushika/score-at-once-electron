"use client"

import { useEffect, useState } from "react"

interface StudentWithMemberships {
  id: string
  studentId: string
  lastName: string
  firstName: string
  lastNameKana: string
  firstNameKana: string
  enrollmentYear?: number | null
}

interface ClassWithMemberships {
  id: string
  name: string
  classCode?: string | null
  grade?: number | null
  description?: string | null
  isVisible?: boolean
  memberships: Array<{
    id: string
    startDate: Date
    endDate?: Date | null
    attendanceNumber?: number | null
    notes?: string | null
    student: {
      id: string
      studentId: string
      lastName: string
      firstName: string
      firstNameKana: string
    }
  }>
}

interface Membership {
  id: string
  startDate: Date
  endDate?: Date | null
  attendanceNumber?: number | null
  notes?: string | null
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
    null,
  )

  const transformClassData = (rawClassData: any): ClassWithMemberships => ({
    ...rawClassData,
    memberships:
      rawClassData.memberships?.map((membership: any) => ({
        ...membership,
        startDate: new Date(membership.startDate || membership.createdAt),
        endDate: membership.endDate ? new Date(membership.endDate) : null,
      })) || [],
  })

  const fetchData = async () => {
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
  }

  useEffect(() => {
    fetchData()
  }, [classId])

  const handleSaveClass = async (classInfo: any) => {
    try {
      const updatedClass = await window.electronAPI.updateClass({
        id: classId,
        ...classInfo,
      })
      setClassData(transformClassData(updatedClass))
      setIsClassModalOpen(false)
    } catch (error) {
      console.error("Failed to update class:", error)
      alert("学級情報の更新に失敗しました。")
    }
  }

  const handleStudentImportSuccess = async () => {
    // Refresh class data
    const classes = await window.electronAPI.fetchClasses()
    const updatedClass = classes.find((c) => c.id === classId)
    if (updatedClass) {
      setClassData(transformClassData(updatedClass))
    }
    setIsStudentImportModalOpen(false)
  }

  const handleSaveMembership = async (membershipData: any) => {
    try {
      if (membershipToEdit) {
        await window.electronAPI.updateStudentClassMembership(
          membershipToEdit.id,
          membershipData,
        )
      } else {
        await window.electronAPI.addStudentToClass(
          membershipData.studentId,
          classId,
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

  const handleEndMembership = async (membershipId: string) => {
    if (window.confirm("この所属関係を終了しますか？")) {
      try {
        await window.electronAPI.endStudentMembership(membershipId)

        // Refresh class data
        const classes = await window.electronAPI.fetchClasses()
        const updatedClass = classes.find((c) => c.id === classId)
        if (updatedClass) {
          setClassData(transformClassData(updatedClass))
        }
      } catch (error) {
        console.error("Failed to end membership:", error)
        alert("所属関係の終了に失敗しました。")
      }
    }
  }

  const handleBulkEndMemberships = async (membershipIds: string[]) => {
    try {
      // End each membership
      for (const membershipId of membershipIds) {
        await window.electronAPI.endStudentMembership(membershipId)
      }

      // Refresh class data
      const classes = await window.electronAPI.fetchClasses()
      const updatedClass = classes.find((c) => c.id === classId)
      if (updatedClass) {
        setClassData(transformClassData(updatedClass))
      }
    } catch (error) {
      console.error("Failed to end memberships:", error)
      alert("所属関係の終了に失敗しました。")
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
    membershipToEdit,
    setMembershipToEdit,
    handleSaveClass,
    handleStudentImportSuccess,
    handleSaveMembership,
    handleEndMembership,
    handleBulkEndMemberships,
    handleDeleteClass,
    fetchData,
  }
}

export type { ClassWithMemberships, Membership, StudentWithMemberships }
