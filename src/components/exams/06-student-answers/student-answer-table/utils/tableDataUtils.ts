import type {
  DisabledCell,
  ExtendedDisabledState,
} from "@/components/exams/06-student-answers/student-answer-table/types"
import type { DisabledReason } from "@/components/exams/06-student-answers/student-answer-table/types/localTypes"
import type { UnifiedFile } from "@/components/exams/06-student-answers/types"
import type { ExamStudentWithMemberships } from "@/types/prismaExtensions"

/**
 * セルレコード配列に (studentId, pageNumber) が含まれるかを判定する。
 * 文字列合成キーを使わず identity のフィールド比較で照合する（DnD の FileState と同流儀）。
 * ユーザートグル由来の小さな配列（disabledState.cells）専用。
 */
export function hasCell(
  cells: DisabledCell[],
  studentId: string,
  pageNumber: number
): boolean {
  return cells.some(
    (cell) => cell.studentId === studentId && cell.pageNumber === pageNumber
  )
}

/**
 * (studentId, pageNumber) の集合を O(1) 照合するルックアップ。
 * 文字列合成キー（`${a}:${b}`）を使わず studentId → pageNumber集合 の入れ子で持つ。
 * グリッド全体分に膨らみうる派生集合（既存答案・動的無効）向け。
 */
export type CellLookup = Map<string, Set<number>>

export function addCellToLookup(
  lookup: CellLookup,
  studentId: string,
  pageNumber: number
): void {
  const pages = lookup.get(studentId)
  if (pages) {
    pages.add(pageNumber)
  } else {
    lookup.set(studentId, new Set([pageNumber]))
  }
}

export function lookupHasCell(
  lookup: CellLookup,
  studentId: string,
  pageNumber: number
): boolean {
  return lookup.get(studentId)?.has(pageNumber) ?? false
}

/**
 * 手動無効化（行・列・個別セル）の理由を返す唯一の場所。無効でなければ undefined。
 * 「無効か」の真偽と「なぜ無効か」を1回の評価で確定する（判定の二重走査を避ける）。
 * 既存答案(existing_answer)・確認モードの動的無効はここでは扱わない（呼び出し側の責務）。
 */
export function manualDisabledReason(
  disabledState: ExtendedDisabledState,
  examStudent: ExamStudentWithMemberships,
  pageNumber: number
): DisabledReason {
  if (disabledState.rows.includes(examStudent.id)) {
    return examStudent.status === "absent" ? "absent_student" : "row"
  }
  if (disabledState.cols.includes(pageNumber)) return "column"
  if (hasCell(disabledState.cells, examStudent.studentId, pageNumber)) {
    return "position"
  }
  return undefined
}

/** 生徒をcustomOrder昇順にソートした新しい配列を返す */
export function sortStudentsByCustomOrder(
  students: ExamStudentWithMemberships[]
): ExamStudentWithMemberships[] {
  return [...students].sort((studentA, studentB) => {
    const studentAOrder = studentA.customOrder ?? Number.MAX_SAFE_INTEGER
    const studentBOrder = studentB.customOrder ?? Number.MAX_SAFE_INTEGER
    return studentAOrder - studentBOrder
  })
}

/** 確認モードで答案が存在しないセル（無効化対象）を O(1) 照合ルックアップで返す */
export function calculateDynamicDisabledCells(
  files: UnifiedFile[],
  sortedStudents: ExamStudentWithMemberships[],
  masterImageCount: number,
  disabledState: ExtendedDisabledState,
  mode?: "upload" | "view"
): CellLookup {
  const dynamicDisabled: CellLookup = new Map()

  // 確認モードでは答案がないセルのみ無効化
  if (mode === "view") {
    for (const examStudent of sortedStudents) {
      for (let pageIndex = 0; pageIndex < masterImageCount; pageIndex++) {
        const pageNumber = pageIndex + 1

        // 手動無効化済みのセルはスキップ
        if (manualDisabledReason(disabledState, examStudent, pageNumber)) {
          continue
        }

        // そのセルに対応する答案があるかチェック
        const hasAnswerForCell = files.some(
          (file) =>
            file.studentId === examStudent.studentId &&
            file.pageNumber === pageNumber &&
            !disabledState.files.has(file.id)
        )

        // 答案がない場合は動的無効化
        if (!hasAnswerForCell) {
          addCellToLookup(dynamicDisabled, examStudent.studentId, pageNumber)
        }
      }
    }
  }
  // アップロードモードでは動的無効化は行わない（警告オーバーレイのみ）

  return dynamicDisabled
}

/** 既存の答案が割り当てられているセルを O(1) 照合ルックアップで返す（警告オーバーレイ用） */
export function calculateCellsWithExistingAnswers(
  files: UnifiedFile[],
  sortedStudents: ExamStudentWithMemberships[],
  masterImageCount: number,
  disabledState: ExtendedDisabledState,
  mode?: "upload" | "view",
  existingAnswerSheets?: Array<{
    id: string
    studentId: string | null
    pageNumber: number
  }>
): CellLookup {
  const cells: CellLookup = new Map()

  for (const examStudent of sortedStudents) {
    for (let pageIndex = 0; pageIndex < masterImageCount; pageIndex++) {
      const pageNumber = pageIndex + 1

      // そのセルに対応する答案があるかチェック
      let hasAnswerForCell = false

      if (mode === "upload" && existingAnswerSheets) {
        // アップロードモード: existingAnswerSheets から判定
        hasAnswerForCell = existingAnswerSheets.some(
          (sheet) =>
            sheet.studentId === examStudent.studentId &&
            sheet.pageNumber === pageNumber
        )
      } else {
        // 確認モード: files から判定
        hasAnswerForCell = files.some(
          (file) =>
            file.studentId === examStudent.studentId &&
            file.pageNumber === pageNumber &&
            !disabledState.files.has(file.id)
        )
      }

      if (hasAnswerForCell) {
        addCellToLookup(cells, examStudent.studentId, pageNumber)
      }
    }
  }

  return cells
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
