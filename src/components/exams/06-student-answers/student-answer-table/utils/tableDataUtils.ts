import type {
  DisabledCell,
  ExtendedDisabledState,
} from "@/components/exams/06-student-answers/student-answer-table/types"
import type { DisabledReason } from "@/components/exams/06-student-answers/student-answer-table/types"
import type {
  AnswerImageIdentity,
  ExamPageColumn,
} from "@/components/exams/06-student-answers/types"
import type { ExamStudentWithMemberships } from "@/types/prismaExtensions"

/**
 * セルレコード配列に (studentId, examPageId) が含まれるかを判定する。
 * 文字列合成キーを使わず identity のフィールド比較で照合する（DnD の FileState と同流儀）。
 * ユーザートグル由来の小さな配列（disabledState.cells）専用。
 */
export function hasCell(
  cells: DisabledCell[],
  studentId: string,
  examPageId: string
): boolean {
  return cells.some(
    (cell) => cell.studentId === studentId && cell.examPageId === examPageId
  )
}

/**
 * (studentId, examPageId) の集合を O(1) 照合するルックアップ。
 * 文字列合成キー（`${a}:${b}`）を使わず studentId → examPageId集合 の入れ子で持つ。
 * グリッド全体分に膨らみうる派生集合（既存答案・動的無効）向け。
 */
export type CellLookup = Map<string, Set<string>>

export function addCellToLookup(
  lookup: CellLookup,
  studentId: string,
  examPageId: string
): void {
  const pages = lookup.get(studentId)
  if (pages) {
    pages.add(examPageId)
  } else {
    lookup.set(studentId, new Set([examPageId]))
  }
}

export function lookupHasCell(
  lookup: CellLookup,
  studentId: string,
  examPageId: string
): boolean {
  return lookup.get(studentId)?.has(examPageId) ?? false
}

/**
 * (studentId, examPageId) → 値 を O(1) で引く入れ子マップ。
 * CellLookup が「そのセルに該当するか」の真偽だけを持つのに対し、こちらはセルに
 * 紐づく実体（配置された答案など）を保持する。合成文字列キーも序数も使わない。
 */
export type CellValueMap<T> = Map<string, Map<string, T>>

export function setCellValue<T>(
  cellValues: CellValueMap<T>,
  studentId: string,
  examPageId: string,
  value: T
): void {
  const pages = cellValues.get(studentId)
  if (pages) {
    pages.set(examPageId, value)
  } else {
    cellValues.set(studentId, new Map([[examPageId, value]]))
  }
}

export function getCellValue<T>(
  cellValues: CellValueMap<T>,
  studentId: string,
  examPageId: string
): T | undefined {
  return cellValues.get(studentId)?.get(examPageId)
}

/**
 * 手動無効化（行・列・個別セル）の理由を返す唯一の場所。無効でなければ undefined。
 * 「無効か」の真偽と「なぜ無効か」を1回の評価で確定する（判定の二重走査を避ける）。
 * 既存答案(existing_answer)・確認モードの動的無効はここでは扱わない（呼び出し側の責務）。
 */
export function manualDisabledReason(
  disabledState: ExtendedDisabledState,
  examStudent: ExamStudentWithMemberships,
  examPageId: string
): DisabledReason {
  if (disabledState.rows.includes(examStudent.id)) {
    return examStudent.status === "absent" ? "absent_student" : "row"
  }
  if (disabledState.cols.includes(examPageId)) return "column"
  if (hasCell(disabledState.cells, examStudent.studentId, examPageId)) {
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
export function calculateDynamicDisabledCells<T extends AnswerImageIdentity>(
  files: T[],
  sortedStudents: ExamStudentWithMemberships[],
  examPages: ExamPageColumn[],
  disabledState: ExtendedDisabledState,
  mode?: "upload" | "view"
): CellLookup {
  const dynamicDisabled: CellLookup = new Map()

  // 確認モードでは答案がないセルのみ無効化
  if (mode === "view") {
    for (const examStudent of sortedStudents) {
      for (const examPage of examPages) {
        // 手動無効化済みのセルはスキップ
        if (manualDisabledReason(disabledState, examStudent, examPage.id)) {
          continue
        }

        // そのセルに対応する答案があるかチェック
        const hasAnswerForCell = files.some(
          (file) =>
            file.studentId === examStudent.studentId &&
            file.examPageId === examPage.id &&
            !disabledState.files.has(file.id)
        )

        // 答案がない場合は動的無効化
        if (!hasAnswerForCell) {
          addCellToLookup(dynamicDisabled, examStudent.studentId, examPage.id)
        }
      }
    }
  }
  // アップロードモードでは動的無効化は行わない（警告オーバーレイのみ）

  return dynamicDisabled
}

/** 既存の答案が割り当てられているセルを O(1) 照合ルックアップで返す（警告オーバーレイ用） */
export function calculateCellsWithExistingAnswers<
  T extends AnswerImageIdentity,
>(
  files: T[],
  sortedStudents: ExamStudentWithMemberships[],
  examPages: ExamPageColumn[],
  disabledState: ExtendedDisabledState,
  mode?: "upload" | "view",
  existingAnswers?: AnswerImageIdentity[]
): CellLookup {
  const cells: CellLookup = new Map()

  for (const examStudent of sortedStudents) {
    for (const examPage of examPages) {
      // そのセルに対応する答案があるかチェック
      let hasAnswerForCell = false

      if (mode === "upload" && existingAnswers) {
        // アップロードモード: existingAnswers（DB答案の占有信号）から判定
        hasAnswerForCell = existingAnswers.some(
          (answer) =>
            answer.studentId === examStudent.studentId &&
            answer.examPageId === examPage.id
        )
      } else {
        // 確認モード: files から判定
        hasAnswerForCell = files.some(
          (file) =>
            file.studentId === examStudent.studentId &&
            file.examPageId === examPage.id &&
            !disabledState.files.has(file.id)
        )
      }

      if (hasAnswerForCell) {
        addCellToLookup(cells, examStudent.studentId, examPage.id)
      }
    }
  }

  return cells
}

/** 無効化されていないファイルのみをフィルタリングして返す */
export function getEnabledFiles<T extends AnswerImageIdentity>(
  files: T[],
  disabledState: ExtendedDisabledState
): T[] {
  return files.filter((file) => !disabledState.files.has(file.id))
}

/** 無効化されたファイルのみをフィルタリングして返す */
export function getDisabledFiles<T extends AnswerImageIdentity>(
  files: T[],
  disabledState: ExtendedDisabledState
): T[] {
  return files.filter((file) => disabledState.files.has(file.id))
}

/**
 * 確認モード（方式B）: 答案アイテムを「表のマスに置けるもの」と「置けない孤立答案」に分ける。
 *
 * マスに置ける条件は (1) studentId が現在の受験生徒（ロスター）に居る かつ
 * (2) examPageId が現在の列（examPages）に含まれる、の両方。どちらかを満たさない答案は
 * 除籍（studentId が現ロスターに無い）・ページ削除（列に無い examPageId）などで座標配置できず、
 * 表からは不可視になる（＝孤立答案）。呼び出し側で専用枠に描画して再配置できるようにする。
 *
 * placedByCell は (studentId, examPageId) で引く CellValueMap（序数キーは使わない）。
 * 同一セルに複数の配置可能答案が解決された場合は先着のみを配置し、後続は孤立扱いに
 * する（黙って上書きして消さない＝表からも孤立枠からも見えなくなる事故を防ぐ。
 * 実データは @@unique([examPageId, studentId]) によりセル衝突は構造的に起きないが、
 * 「解決不能な画像を黙って落とさない」原則をここで担保する）。
 */
export function partitionAnswerItemsByPlacement<T extends AnswerImageIdentity>(
  items: T[],
  rosterStudentIds: string[],
  examPageIds: string[]
): { placedByCell: CellValueMap<T>; orphans: T[] } {
  const rosterStudentIdSet = new Set(rosterStudentIds)
  const columnPageIdSet = new Set(examPageIds)

  const placedByCell: CellValueMap<T> = new Map()
  const orphans: T[] = []

  for (const answerItem of items) {
    const { studentId, examPageId } = answerItem
    const isPlaceable =
      studentId !== null &&
      examPageId !== null &&
      rosterStudentIdSet.has(studentId) &&
      columnPageIdSet.has(examPageId)

    // 配置可能でも同一セルが既に埋まっていれば孤立へ退避する（上書きで消さない）
    if (
      isPlaceable &&
      getCellValue(placedByCell, studentId, examPageId) === undefined
    ) {
      setCellValue(placedByCell, studentId, examPageId, answerItem)
    } else {
      orphans.push(answerItem)
    }
  }

  return { placedByCell, orphans }
}
