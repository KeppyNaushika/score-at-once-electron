"use client"

import { StudentWithAnswers } from "@/components/projects/06-answer-sheets/answer-sheet-management/hooks/types"
import { useCallback, useEffect, useState } from "react"

interface UseStudentManagementProps {
  students: Array<{
    id: string
    lastName: string
    firstName: string
    lastNameKana: string
    firstNameKana: string
    studentId: string
    attendanceNumber?: number | null
    status?: "participating" | "expected" | "absent"
    customOrder?: number | null
  }>
}

export function useStudentManagement({ students }: UseStudentManagementProps) {
  const [studentsWithAnswers, setStudentsWithAnswers] = useState<
    StudentWithAnswers[]
  >([])

  // 学生データの更新
  const updateStudentsWithAnswers = useCallback(() => {
    const updatedStudents = students.map((student) => ({
      ...student,
      isSelected: true,
      hasExistingAnswers: false,
      overwrite: false,
    }))
    setStudentsWithAnswers(updatedStudents)
  }, [students])

  // studentsが変更されたときに自動更新
  useEffect(() => {
    updateStudentsWithAnswers()
  }, [updateStudentsWithAnswers])

  // 学生選択状態の切り替え
  const toggleStudentSelection = useCallback((studentId: string) => {
    setStudentsWithAnswers((prev) =>
      prev.map((student) =>
        student.id === studentId
          ? { ...student, isSelected: !student.isSelected }
          : student,
      ),
    )
  }, [])

  // 全学生の選択状態切り替え
  const toggleAllStudents = useCallback((selected: boolean) => {
    setStudentsWithAnswers((prev) =>
      prev.map((student) => ({ ...student, isSelected: selected })),
    )
  }, [])

  // 上書き設定の切り替え
  const toggleOverwrite = useCallback((studentId: string) => {
    setStudentsWithAnswers((prev) =>
      prev.map((student) =>
        student.id === studentId
          ? { ...student, overwrite: !student.overwrite }
          : student,
      ),
    )
  }, [])

  return {
    studentsWithAnswers,
    setStudentsWithAnswers,
    updateStudentsWithAnswers,
    toggleStudentSelection,
    toggleAllStudents,
    toggleOverwrite,
  }
}
