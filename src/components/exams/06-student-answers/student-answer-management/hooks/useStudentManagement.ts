"use client"

import { useCallback, useEffect, useState } from "react"

import { StudentWithAnswers } from "@/components/exams/06-student-answers/student-answer-management/hooks/types"
import type { StudentStatus } from "@/types/studentStatus.types"

interface UseStudentManagementProps {
  students: Array<{
    id: string
    lastName: string
    firstName: string
    lastNameKana: string
    firstNameKana: string
    studentId: string
    attendanceNumber?: number | null
    status?: StudentStatus
    customOrder?: number | null
  }>
}

/** 答案アップロード時の生徒選択状態・上書き設定を管理するフック */
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
    const frame = requestAnimationFrame(() => {
      updateStudentsWithAnswers()
    })

    return () => cancelAnimationFrame(frame)
  }, [updateStudentsWithAnswers])

  // 学生選択状態の切り替え
  const toggleStudentSelection = useCallback((studentId: string) => {
    setStudentsWithAnswers((prev) =>
      prev.map((student) =>
        student.id === studentId
          ? { ...student, isSelected: !student.isSelected }
          : student
      )
    )
  }, [])

  // 全学生の選択状態切り替え
  const toggleAllStudents = useCallback((selected: boolean) => {
    setStudentsWithAnswers((prev) =>
      prev.map((student) => ({ ...student, isSelected: selected }))
    )
  }, [])

  // 上書き設定の切り替え
  const toggleOverwrite = useCallback((studentId: string) => {
    setStudentsWithAnswers((prev) =>
      prev.map((student) =>
        student.id === studentId
          ? { ...student, overwrite: !student.overwrite }
          : student
      )
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
