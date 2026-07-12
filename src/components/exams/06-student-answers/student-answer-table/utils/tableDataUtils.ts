import type {
  DisabledCell,
  ExtendedDisabledState,
} from "@/components/exams/06-student-answers/student-answer-table/types"
import type { DisabledReason } from "@/components/exams/06-student-answers/student-answer-table/types/localTypes"
import type { AnswerItem } from "@/components/exams/06-student-answers/types"
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
export function calculateDynamicDisabledCells<T extends AnswerItem>(
  files: T[],
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
export function calculateCellsWithExistingAnswers<T extends AnswerItem>(
  files: T[],
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
export function getEnabledFiles<T extends AnswerItem>(
  files: T[],
  disabledState: ExtendedDisabledState
): T[] {
  return files.filter((file) => !disabledState.files.has(file.id))
}

/** 無効化されたファイルのみをフィルタリングして返す */
export function getDisabledFiles<T extends AnswerItem>(
  files: T[],
  disabledState: ExtendedDisabledState
): T[] {
  return files.filter((file) => disabledState.files.has(file.id))
}

/**
 * 確認モード（方式B）: 答案アイテムを「表のマスに置けるもの」と「置けない孤立答案」に分ける。
 *
 * マスに置ける条件は (1) studentId が現在の受験生徒（ロスター）に居る かつ
 * (2) pageNumber が 1..modelAnswerCount の範囲内、の両方。どちらかを満たさない答案は
 * 除籍（studentId が現ロスターに無い）・ページ数削減（範囲外）などで座標配置できず、
 * 表からは不可視になる（＝孤立答案）。呼び出し側で専用枠に描画して再配置できるようにする。
 *
 * placedByCell のキーは `${studentIndex}-${pageIndex}`（0始まり）。
 * 同一セルに複数の配置可能答案が解決された場合は先着のみを配置し、後続は孤立扱いに
 * する（黙って上書きして消さない＝表からも孤立枠からも見えなくなる事故を防ぐ）。
 */
export function partitionAnswerItemsByPlacement<T extends AnswerItem>(
  items: T[],
  sortedStudentIds: string[],
  modelAnswerCount: number
): { placedByCell: Map<string, T>; orphans: T[] } {
  const studentIndexById = new Map<string, number>()
  sortedStudentIds.forEach((studentId, studentIndex) => {
    studentIndexById.set(studentId, studentIndex)
  })

  const placedByCell = new Map<string, T>()
  const orphans: T[] = []

  for (const answerItem of items) {
    const studentIndex = answerItem.studentId
      ? studentIndexById.get(answerItem.studentId)
      : undefined
    const pageIndex = answerItem.pageNumber - 1
    const cellKey = `${studentIndex}-${pageIndex}`
    const isPlaceable =
      studentIndex !== undefined &&
      pageIndex >= 0 &&
      pageIndex < modelAnswerCount

    // 配置可能でも同一セルが既に埋まっていれば孤立へ退避する（上書きで消さない）
    if (isPlaceable && !placedByCell.has(cellKey)) {
      placedByCell.set(cellKey, answerItem)
    } else {
      orphans.push(answerItem)
    }
  }

  return { placedByCell, orphans }
}

/** ファイルIDのハッシュからTailwind背景色クラスを決定する */
export function getFileColor(file: AnswerItem): string {
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
