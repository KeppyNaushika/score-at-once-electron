import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

import {
  createStudentMutation,
  studentListQuery,
  updateStudentMutation,
} from "@/queries/student"
import type { StudentWithMemberships } from "@/types/prismaExtensions"

interface StudentImportRow {
  studentNumber: string
  lastName: string
  firstName: string
  lastNameKana: string
  firstNameKana: string
  enrollmentYear: string
  isDuplicate?: boolean
}

interface ValidationResult {
  valid: number
  errors: string[]
  warnings: string[]
}

/**
 * 生徒データの手動入力・バリデーション・一括インポートを管理するフック
 *
 * @param existingStudents 既に登録済みの生徒。重複判定と警告文に使う。呼び出し元の
 *   画面が読み込み済みのものをそのまま渡す（セルを離れるたびに全件を取り直さない）
 */
export function useStudentImport(existingStudents: StudentWithMemberships[]) {
  const queryClient = useQueryClient()
  const createStudent = useMutation(createStudentMutation())
  const updateStudent = useMutation(updateStudentMutation())
  const [studentData, setStudentData] = useState<StudentImportRow[]>([
    {
      studentNumber: "",
      lastName: "",
      firstName: "",
      lastNameKana: "",
      firstNameKana: "",
      enrollmentYear: "",
    },
  ])

  const [studentValidation, setStudentValidation] = useState<ValidationResult>({
    valid: 0,
    errors: [],
    warnings: [],
  })
  const [isProcessing, setIsProcessing] = useState(false)

  const existingStudentNumbers = new Set(
    existingStudents.map((student) => student.studentNumber)
  )

  const handleStudentDataChange = (rows: StudentImportRow[]) => {
    setStudentData(markDuplicateStudents(rows))
    validateStudentData(rows)
  }

  const markDuplicateStudents = (data: StudentImportRow[]) =>
    data.map((row) => ({
      ...row,
      isDuplicate: existingStudentNumbers.has(row.studentNumber?.trim() || ""),
    }))

  const validateStudentData = (data: StudentImportRow[]) => {
    const errors: string[] = []
    const warnings: string[] = []
    const seenStudentNumbers = new Set<string>()
    let validCount = 0

    const filteredData = data.filter(
      (row) =>
        row.studentNumber?.trim() ||
        row.lastName?.trim() ||
        row.firstName?.trim()
    )

    filteredData.forEach((row, index) => {
      const rowNum = index + 1

      if (!row.studentNumber?.trim()) {
        errors.push(`行${rowNum}: 学籍番号が入力されていません`)
        return
      }
      if (!row.lastName?.trim()) {
        errors.push(`行${rowNum}: 姓が入力されていません`)
        return
      }
      if (!row.firstName?.trim()) {
        errors.push(`行${rowNum}: 名が入力されていません`)
        return
      }

      if (seenStudentNumbers.has(row.studentNumber.trim())) {
        errors.push(
          `行${rowNum}: 学籍番号「${row.studentNumber}」が重複しています`
        )
        return
      }
      seenStudentNumbers.add(row.studentNumber.trim())

      // 既存生徒チェック
      if (existingStudentNumbers.has(row.studentNumber.trim())) {
        warnings.push(
          `行${rowNum}: 学籍番号「${row.studentNumber}」は既に登録済みです（上書きされます）`
        )
      }

      if (!row.lastNameKana?.trim()) {
        warnings.push(`行${rowNum}: 姓カナが入力されていません`)
      }
      if (!row.firstNameKana?.trim()) {
        warnings.push(`行${rowNum}: 名カナが入力されていません`)
      }

      validCount++
    })

    setStudentValidation({ valid: validCount, errors, warnings })
  }

  const handleImportStudents = async () => {
    if (studentValidation.errors.length > 0) return

    setIsProcessing(true)

    try {
      const imported: StudentWithMemberships[] = []

      // 既存の生徒データを取得
      const existingStudents = await queryClient.fetchQuery(studentListQuery())
      const existingStudentNumbers = new Set(
        existingStudents.map((student) => student.studentNumber)
      )

      const validStudentData = studentData.filter(
        (row) =>
          row.studentNumber?.trim() &&
          row.lastName?.trim() &&
          row.firstName?.trim()
      )

      for (const row of validStudentData) {
        const studentNumber = row.studentNumber.trim()

        const studentData = {
          studentNumber,
          lastName: row.lastName.trim(),
          firstName: row.firstName.trim(),
          lastNameKana: row.lastNameKana?.trim() || "",
          firstNameKana: row.firstNameKana?.trim() || "",
          enrollmentYear: row.enrollmentYear
            ? parseInt(row.enrollmentYear)
            : undefined,
        }

        // 既存チェック - 上書きまたは新規作成
        if (existingStudentNumbers.has(studentNumber)) {
          const existingStudent = existingStudents.find(
            (student) => student.studentNumber === studentNumber
          )
          if (existingStudent) {
            // 既存生徒を更新
            const updatedStudent = await updateStudent.mutateAsync({
              id: existingStudent.id,
              student: studentData,
            })
            imported.push(updatedStudent)
          }
        } else {
          // 新規生徒を作成
          const newStudent = await createStudent.mutateAsync(studentData)
          imported.push(newStudent)
        }
      }

      return imported
    } catch (error) {
      console.error("Student import failed:", error)
      throw error
    } finally {
      setIsProcessing(false)
    }
  }

  return {
    studentData,
    studentValidation,
    isProcessing,
    handleStudentDataChange,
    handleImportStudents,
  }
}
