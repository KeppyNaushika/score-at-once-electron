import { useState } from "react"

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

export function useStudentImport() {
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

  const handleStudentDataChange = (data: StudentImportRow[]) => {
    // 重複チェックとフラグ設定
    markDuplicateStudents(data).then((updatedData) => {
      setStudentData(updatedData)
      validateStudentData(updatedData).catch((error) => {
        console.error("Validation failed:", error)
      })
    })
  }

  const markDuplicateStudents = async (data: StudentImportRow[]) => {
    // 既存の生徒データを取得
    let existingStudentNumbers: Set<string> = new Set()
    try {
      const existingStudents = await window.electronAPI.fetchStudents()
      existingStudentNumbers = new Set(
        existingStudents.map((s) => s.studentNumber)
      )
    } catch (error) {
      console.warn("既存生徒の取得に失敗しました:", error)
    }

    // 重複フラグを設定
    return data.map((row) => ({
      ...row,
      isDuplicate: existingStudentNumbers.has(row.studentNumber?.trim() || ""),
    }))
  }

  const validateStudentData = async (data: StudentImportRow[]) => {
    const errors: string[] = []
    const warnings: string[] = []
    const seenStudentNumbers = new Set<string>()
    let validCount = 0

    // 既存の生徒データを取得
    let existingStudentNumbers: Set<string> = new Set()
    try {
      const existingStudents = await window.electronAPI.fetchStudents()
      existingStudentNumbers = new Set(
        existingStudents.map((s) => s.studentNumber)
      )
    } catch (error) {
      console.warn("既存生徒の取得に失敗しました:", error)
    }

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
      const existingStudents = await window.electronAPI.fetchStudents()
      const existingStudentNumbers = new Set(
        existingStudents.map((s) => s.studentNumber)
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
            (s) => s.studentNumber === studentNumber
          )
          if (existingStudent) {
            // 既存生徒を更新
            const updatedStudent = await window.electronAPI.updateStudent(
              existingStudent.id,
              studentData
            )
            imported.push(updatedStudent)
          }
        } else {
          // 新規生徒を作成
          const newStudent = await window.electronAPI.createStudent(studentData)
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
