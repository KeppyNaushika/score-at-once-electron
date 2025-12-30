import type { ExtendedDisabledState } from "@/components/projects/06-student-answers/student-answer-table/types"
import type { UnifiedFile, UnifiedStudent } from "@/components/projects/06-student-answers/types"

/**
 * 生徒をcustomOrder順にソートする
 */
export function sortStudentsByCustomOrder(students: UnifiedStudent[]): UnifiedStudent[] {
  return [...students].sort((a, b) => {
    const aOrder = a.customOrder ?? Number.MAX_SAFE_INTEGER
    const bOrder = b.customOrder ?? Number.MAX_SAFE_INTEGER
    return aOrder - bOrder
  })
}

/**
 * 動的無効化計算：答案がない位置を無効化（確認モードのみ）
 */
export function calculateDynamicDisabledPositions(
  files: UnifiedFile[],
  sortedStudents: UnifiedStudent[],
  masterImageCount: number,
  disabledState: ExtendedDisabledState,
  mode?: "upload" | "view",
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
            file.studentId === student.id &&
            file.pageNumber === pageNumber &&
            !disabledState.files.has(file.id),
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

/**
 * 既存答案がある位置の計算（警告オーバーレイ用）
 */
export function calculatePositionsWithExistingAnswers(
  files: UnifiedFile[],
  sortedStudents: UnifiedStudent[],
  masterImageCount: number,
  disabledState: ExtendedDisabledState,
  mode?: "upload" | "view",
  existingAnswerSheets?: Array<{
    id: string
    studentId: string | null
    pageNumber: number
  }>,
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
            sheet.studentId === student.id && sheet.pageNumber === pageNumber,
        )
      } else {
        // 確認モード: files から判定
        hasAnswerForPosition = files.some(
          (file) =>
            file.studentId === student.id &&
            file.pageNumber === pageNumber &&
            !disabledState.files.has(file.id),
        )
      }

      if (hasAnswerForPosition) {
        positions.add(position)
      }
    }
  }

  return positions
}

/**
 * 有効ファイルのフィルタリング
 */
export function getEnabledFiles(
  files: UnifiedFile[],
  disabledState: ExtendedDisabledState,
): UnifiedFile[] {
  return files.filter((file) => !disabledState.files.has(file.id))
}

/**
 * 無効ファイルのフィルタリング
 */
export function getDisabledFiles(
  files: UnifiedFile[],
  disabledState: ExtendedDisabledState,
): UnifiedFile[] {
  return files.filter((file) => disabledState.files.has(file.id))
}

/**
 * ファイルの色を計算する
 */
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