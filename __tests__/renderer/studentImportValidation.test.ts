/**
 * 生徒の貼り付け取り込みの判定。
 *
 * - 学級への取り込みは、検証を通った行だけを取り込む（表示の件数と取り込む行を一致させる）
 * - 見つからない・書けなかった学籍番号は、1件ずつでなくまとめて1つの通知に載せる
 */

import { describe, expect, it } from "vitest"

import {
  type ClassroomStudentImportRow,
  validateClassroomStudentImportRows,
} from "@/components/classroom/classroomStudentImportValidation"
import { summarizeStudentNumbers } from "@/lib/studentNumberSummary"

const importRow = (
  overrides: Partial<ClassroomStudentImportRow>
): ClassroomStudentImportRow => ({
  studentId: "",
  attendanceNumber: "",
  startDate: "",
  endDate: "",
  ...overrides,
})

describe("validateClassroomStudentImportRows", () => {
  it("空行だけなら未入力のエラーにし、取り込む行は無い", () => {
    const validation = validateClassroomStudentImportRows([importRow({})])
    expect(validation.validRows).toEqual([])
    expect(validation.errors).toHaveLength(1)
  })

  it("重複した学籍番号の2行目は取り込む行に入れない", () => {
    const firstRow = importRow({ studentId: "S001", attendanceNumber: "1" })
    const duplicateRow = importRow({ studentId: "S001", attendanceNumber: "2" })
    const validation = validateClassroomStudentImportRows([
      firstRow,
      duplicateRow,
    ])
    expect(validation.validRows).toEqual([firstRow])
    expect(validation.errors).toEqual([
      "行2: 学籍番号「S001」が重複しています。",
    ])
  })

  it("出席番号・日付の形式が不正な行は取り込む行に入れない", () => {
    const goodRow = importRow({ studentId: "S001", startDate: "2026/4/1" })
    const validation = validateClassroomStudentImportRows([
      goodRow,
      importRow({ studentId: "S002", attendanceNumber: "abc" }),
      importRow({ studentId: "S003", startDate: "2026-04-01" }),
      importRow({ studentId: "S004", endDate: "4/1" }),
    ])
    expect(validation.validRows).toEqual([goodRow])
    expect(validation.errors).toHaveLength(3)
  })

  it("空行は飛ばし、有効な行はすべて取り込む", () => {
    const rows = [
      importRow({ studentId: "S001" }),
      importRow({}),
      importRow({ studentId: "S002" }),
    ]
    const validation = validateClassroomStudentImportRows(rows)
    expect(validation.validRows.map((row) => row.studentId)).toEqual([
      "S001",
      "S002",
    ])
    expect(validation.errors).toEqual([])
  })
})

describe("summarizeStudentNumbers", () => {
  it("10件までは全部並べる", () => {
    expect(summarizeStudentNumbers(["S001", "S002"])).toBe("S001、S002")
  })

  it("10件を超えたら先頭10件と残りの件数を言う", () => {
    const studentNumbers = Array.from(
      { length: 13 },
      (_, index) => `S${String(index + 1).padStart(3, "0")}`
    )
    expect(summarizeStudentNumbers(studentNumbers)).toBe(
      "S001、S002、S003、S004、S005、S006、S007、S008、S009、S010 ほか3件"
    )
  })
})
