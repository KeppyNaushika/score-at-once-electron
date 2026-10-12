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
  /** 検証を通った行。取り込むのはこの行だけ（表示の件数と取り込む行を一致させる） */
  validRows: StudentImportRow[]
}

interface StudentImportOutcome {
  importedStudents: StudentWithMemberships[]
  /** 書き込みに失敗した行の学籍番号（1件の失敗で残りを止めず、最後にまとめて知らせる） */
  failedStudentNumbers: string[]
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
    validRows: [],
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
    const validRows: StudentImportRow[] = []

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

      validRows.push(row)
    })

    setStudentValidation({
      valid: validRows.length,
      errors,
      warnings,
      validRows,
    })
  }

  const handleImportStudents = async (): Promise<
    StudentImportOutcome | undefined
  > => {
    if (
      studentValidation.errors.length > 0 ||
      studentValidation.validRows.length === 0
    ) {
      return undefined
    }

    setIsProcessing(true)

    try {
      const importedStudents: StudentWithMemberships[] = []
      const failedStudentNumbers: string[] = []

      // 書き込む直前の生徒一覧で上書きか新規かを決める（画面の読み込み後に増えた分も拾う）
      const latestStudents = await queryClient.fetchQuery(studentListQuery())
      const latestStudentByNumber = new Map(
        latestStudents.map((student) => [student.studentNumber, student])
      )

      // 検証を通った行だけを取り込む（表示した件数と一致させる）
      for (const row of studentValidation.validRows) {
        const studentNumber = row.studentNumber.trim()

        const studentInput = {
          studentNumber,
          lastName: row.lastName.trim(),
          firstName: row.firstName.trim(),
          lastNameKana: row.lastNameKana?.trim() || "",
          firstNameKana: row.firstNameKana?.trim() || "",
          enrollmentYear: row.enrollmentYear
            ? parseInt(row.enrollmentYear)
            : undefined,
        }

        try {
          // 既存チェック - 上書きまたは新規作成
          const existingStudent = latestStudentByNumber.get(studentNumber)
          if (existingStudent) {
            const updatedStudent = await updateStudent.mutateAsync({
              id: existingStudent.id,
              student: studentInput,
            })
            importedStudents.push(updatedStudent)
          } else {
            const newStudent = await createStudent.mutateAsync(studentInput)
            importedStudents.push(newStudent)
          }
        } catch (error) {
          // 1件ごとの失敗は書き込みの共通のトーストが知らせる。ここでは番号を集めて最後にまとめる
          console.error(`学籍番号 ${studentNumber} の登録に失敗:`, error)
          failedStudentNumbers.push(studentNumber)
        }
      }

      return { importedStudents, failedStudentNumbers }
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
