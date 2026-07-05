import type { ExtendedDisabledState } from "@/components/exams/06-student-answers/student-answer-table/types"
import type { UnifiedFile } from "@/components/exams/06-student-answers/types"
import type { ExamStudentWithDetails } from "@/types/prismaExtensions"

/** 生徒をcustomOrder昇順にソートした新しい配列を返す */
export function sortStudentsByCustomOrder(
  students: ExamStudentWithDetails[]
): ExamStudentWithDetails[] {
  return [...students].sort((studentA, studentB) => {
    const studentAOrder = studentA.customOrder ?? Number.MAX_SAFE_INTEGER
    const studentBOrder = studentB.customOrder ?? Number.MAX_SAFE_INTEGER
    return studentAOrder - studentBOrder
  })
}

/** 確認モードで答案が存在しないテーブル位置を無効化するSetを返す */
export function calculateDynamicDisabledPositions(
  files: UnifiedFile[],
  sortedStudents: ExamStudentWithDetails[],
  masterImageCount: number,
  disabledState: ExtendedDisabledState,
  mode?: "upload" | "view"
): Set<number> {
  const dynamicDisabled = new Set<number>()

  // 確認モードでは答案がない位置のみ無効化
  if (mode === "view") {
    for (
      let studentIndex = 0;
      studentIndex < sortedStudents.length;
      studentIndex++
    ) {
      const student = sortedStudents[studentIndex]

      for (let pageIndex = 0; pageIndex < masterImageCount; pageIndex++) {
        const pageNumber = pageIndex + 1
        const position = studentIndex * masterImageCount + pageIndex

        // 手動無効化済みの位置はスキップ
        if (
          disabledState.rows.has(studentIndex) ||
          disabledState.cols.has(pageIndex) ||
          disabledState.positions.has(position)
        ) {
          continue
        }

        // その位置に対応する答案があるかチェック
        const hasAnswerForPosition = files.some(
          (file) =>
            file.studentId === student.studentId &&
            file.pageNumber === pageNumber &&
            !disabledState.files.has(file.id)
        )

        // 答案がない場合は動的無効化
        if (!hasAnswerForPosition) {
          dynamicDisabled.add(position)
        }
      }
    }
  }
  // アップロードモードでは動的無効化は行わない（警告オーバーレイのみ）

  return dynamicDisabled
}

/** 既存の答案が割り当てられているテーブル位置のSetを返す（警告オーバーレイ用） */
export function calculatePositionsWithExistingAnswers(
  files: UnifiedFile[],
  sortedStudents: ExamStudentWithDetails[],
  masterImageCount: number,
  disabledState: ExtendedDisabledState,
  mode?: "upload" | "view",
  existingAnswerSheets?: Array<{
    id: string
    studentId: string | null
    pageNumber: number
  }>
): Set<number> {
  const positions = new Set<number>()

  // sortedStudentsを使用してテーブル表示順序と一致させる
  for (
    let studentIndex = 0;
    studentIndex < sortedStudents.length;
    studentIndex++
  ) {
    const student = sortedStudents[studentIndex]

    for (let pageIndex = 0; pageIndex < masterImageCount; pageIndex++) {
      const pageNumber = pageIndex + 1
      const position = studentIndex * masterImageCount + pageIndex

      // その位置に対応する答案があるかチェック
      let hasAnswerForPosition = false

      if (mode === "upload" && existingAnswerSheets) {
        // アップロードモード: existingAnswerSheets から判定
        hasAnswerForPosition = existingAnswerSheets.some(
          (sheet) =>
            sheet.studentId === student.studentId &&
            sheet.pageNumber === pageNumber
        )
      } else {
        // 確認モード: files から判定
        hasAnswerForPosition = files.some(
          (file) =>
            file.studentId === student.studentId &&
            file.pageNumber === pageNumber &&
            !disabledState.files.has(file.id)
        )
      }

      if (hasAnswerForPosition) {
        positions.add(position)
      }
    }
  }

  return positions
}

/** 無効化されていないファイルのみをフィルタリングして返す */
export function getEnabledFiles(
  files: UnifiedFile[],
  disabledState: ExtendedDisabledState
): UnifiedFile[] {
  return files.filter((file) => !disabledState.files.has(file.id))
}

/** 無効化されたファイルのみをフィルタリングして返す */
export function getDisabledFiles(
  files: UnifiedFile[],
  disabledState: ExtendedDisabledState
): UnifiedFile[] {
  return files.filter((file) => disabledState.files.has(file.id))
}

/** ファイルIDのハッシュからTailwind背景色クラスを決定する */
export function getFileColor(file: UnifiedFile): string {
  const colors = [
    "bg-red-200",
    "bg-blue-200",
    "bg-green-200",
    "bg-yellow-200",
    "bg-purple-200",
    "bg-pink-200",
    "bg-indigo-200",
    "bg-teal-200",
  ]
  const hash = file.id
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return colors[hash % colors.length]
}
