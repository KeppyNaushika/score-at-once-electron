export interface ClassroomStudentImportRow {
  studentId: string
  attendanceNumber: string
  startDate: string
  endDate: string
}

interface ClassroomStudentImportValidation {
  /** 検証を通った行。取り込むのはこの行だけ（表示の件数と取り込む行を一致させる） */
  validRows: ClassroomStudentImportRow[]
  errors: string[]
  warnings: string[]
}

const isValidDate = (dateText: string): boolean => {
  if (!/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(dateText)) return false
  const date = new Date(dateText.replace(/\//g, "-"))
  return !isNaN(date.getTime())
}

/** 学級への貼り付け取り込みの行を検証し、取り込める行とエラーを分ける */
export function validateClassroomStudentImportRows(
  rows: ClassroomStudentImportRow[]
): ClassroomStudentImportValidation {
  const errors: string[] = []
  const warnings: string[] = []
  const validRows: ClassroomStudentImportRow[] = []

  const nonEmptyRows = rows.filter(
    (row) =>
      row.studentId.trim() !== "" ||
      row.attendanceNumber.trim() !== "" ||
      row.startDate.trim() !== "" ||
      row.endDate.trim() !== ""
  )

  if (nonEmptyRows.length === 0) {
    errors.push("学籍番号が入力されていません。")
    return { validRows, errors, warnings }
  }

  const seenStudentNumbers = new Set<string>()

  nonEmptyRows.forEach((row, index) => {
    const studentNumber = row.studentId.trim()
    const attendanceNumber = row.attendanceNumber.trim()

    if (!studentNumber) {
      errors.push(`行${index + 1}: 学籍番号が入力されていません。`)
      return
    }

    if (attendanceNumber && isNaN(parseInt(attendanceNumber))) {
      errors.push(`行${index + 1}: 出席番号は数値で入力してください。`)
      return
    }

    if (row.startDate.trim() && !isValidDate(row.startDate.trim())) {
      errors.push(
        `行${index + 1}: 開始日の形式が不正です。YYYY/M/D形式で入力してください。`
      )
      return
    }

    if (row.endDate.trim() && !isValidDate(row.endDate.trim())) {
      errors.push(
        `行${index + 1}: 終了日の形式が不正です。YYYY/M/D形式で入力してください。`
      )
      return
    }

    if (seenStudentNumbers.has(studentNumber)) {
      errors.push(
        `行${index + 1}: 学籍番号「${studentNumber}」が重複しています。`
      )
      return
    }

    seenStudentNumbers.add(studentNumber)
    validRows.push(row)
  })

  return { validRows, errors, warnings }
}
