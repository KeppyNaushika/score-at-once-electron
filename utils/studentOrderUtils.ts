/**
 * 受験生徒順序管理ユーティリティ
 * 04-studentsと同じソート論理を実装
 */

import type { UnifiedStudent } from "@/types/answer-sheet.types"

/**
 * 受験生徒を適切な順序でソートする
 * 04-studentsと05-answer-sheets/page.tsxで使用されているロジックと同一
 * 
 * ソート優先度:
 * 1. customOrder（設定されている場合）
 * 2. attendanceNumber（出席番号）
 * 3. 名前順（lastName + firstName）
 */
export function sortStudentsForTable(students: UnifiedStudent[]): UnifiedStudent[] {
  return students
    .filter((s) => s.status === "participating") // 受験する生徒のみ
    .sort((a, b) => {
      // customOrderが設定されている場合はそれを優先
      if (
        a.customOrder !== null &&
        a.customOrder !== undefined &&
        b.customOrder !== null &&
        b.customOrder !== undefined
      ) {
        return a.customOrder - b.customOrder
      }
      if (a.customOrder !== null && a.customOrder !== undefined) return -1
      if (b.customOrder !== null && b.customOrder !== undefined) return 1

      // customOrderが未設定の場合は出席番号順をフォールバック
      const aNumber = a.attendanceNumber
      const bNumber = b.attendanceNumber

      if (aNumber && bNumber) {
        return aNumber - bNumber
      }
      if (aNumber) return -1
      if (bNumber) return 1

      // 出席番号もない場合は名前順
      const aName = `${a.lastName}${a.firstName}`
      const bName = `${b.lastName}${b.firstName}`
      return aName.localeCompare(bName)
    })
}

/**
 * 生徒IDから表の行インデックスを取得
 */
export function getStudentRowIndex(
  studentId: string,
  sortedStudents: UnifiedStudent[]
): number {
  return sortedStudents.findIndex((student) => student.id === studentId)
}

/**
 * 行インデックスから生徒を取得
 */
export function getStudentByRowIndex(
  rowIndex: number,
  sortedStudents: UnifiedStudent[]
): UnifiedStudent | null {
  return sortedStudents[rowIndex] || null
}

/**
 * table-dnd-kit-testのposition計算
 * position = studentIndex * maxPages + (pageNumber - 1)
 */
export function calculatePosition(
  studentIndex: number,
  pageNumber: number,
  maxPages: number
): number {
  return studentIndex * maxPages + (pageNumber - 1)
}

/**
 * positionから生徒インデックスとページ番号を逆算
 */
export function parsePosition(
  position: number,
  maxPages: number
): { studentIndex: number; pageNumber: number } {
  const studentIndex = Math.floor(position / maxPages)
  const pageNumber = (position % maxPages) + 1
  return { studentIndex, pageNumber }
}

/**
 * 生徒の表示名を取得（姓名の組み合わせ）
 */
export function getStudentDisplayName(student: UnifiedStudent): string {
  return `${student.lastName} ${student.firstName}`
}

/**
 * 生徒の表示名（ふりがな）を取得
 */
export function getStudentKanaName(student: UnifiedStudent): string {
  return `${student.lastNameKana} ${student.firstNameKana}`
}

/**
 * 受験生徒の基本情報を表示用に整形
 */
export function formatStudentInfo(student: UnifiedStudent): {
  displayName: string
  kanaName: string
  studentId: string
  attendanceNumber: string
} {
  return {
    displayName: getStudentDisplayName(student),
    kanaName: getStudentKanaName(student),
    studentId: student.studentId,
    attendanceNumber: student.attendanceNumber 
      ? `${student.attendanceNumber}番` 
      : "未設定"
  }
}

/**
 * デバッグ用: 生徒順序の確認
 */
export function debugStudentOrder(students: UnifiedStudent[]): void {
  const sorted = sortStudentsForTable(students)
  console.log("🔍 受験生徒順序（デバッグ）:")
  sorted.forEach((student, index) => {
    console.log(
      `  ${index}: ${getStudentDisplayName(student)} (ID: ${student.studentId}, customOrder: ${student.customOrder}, 出席番号: ${student.attendanceNumber})`
    )
  })
}