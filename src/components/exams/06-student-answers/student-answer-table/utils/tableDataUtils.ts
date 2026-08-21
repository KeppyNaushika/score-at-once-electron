import type { ExamPage } from "@prisma/client"

import type {
  DisabledCell,
  ExtendedDisabledState,
} from "@/components/exams/06-student-answers/student-answer-table/types"
import type { DisabledReason } from "@/components/exams/06-student-answers/student-answer-table/types"
import type { AnswerImageIdentity } from "@/components/exams/06-student-answers/types"
import type { StudentAnswerDatasetExamStudent } from "@/types/prismaExtensions"

/**
 * セルレコード配列に (受験者, ページ) が含まれるかを判定する。
 * 文字列合成キーを使わず identity のフィールド比較で照合する（DnD の FileState と同流儀）。
 * ユーザートグル由来の小さな配列（disabledState.cells）専用。
 */
function hasCell(
  cells: DisabledCell[],
  examStudent: CellRow,
  examPage: CellColumn
): boolean {
  return cells.some(
    (cell) =>
      cell.examStudentId === examStudent.id && cell.examPageId === examPage.id
  )
}

/**
 * セルの行＝受験者、列＝ページ。**実体をそのまま受け取る**（呼び出し側に
 * `examStudent.id` を書かせない）。
 *
 * `ExamStudent.id` と `Student.id` はどちらも `string` なので、id を引数に取ると
 * 取り違えても型検査が通ってしまう（実際にそれで表が全滅した）。実体を要求すれば
 * `examStudent.studentId` を渡した時点でコンパイルエラーになる。
 *
 * さらに、行と列で**必須フィールドを重ならせない**（行は `studentId`、列は `pageNumber`）。
 * 両方を `{ id: string }` にすると互いに代入可能で、引数を転置しても
 * コンパイルが通ってしまう（＝表が全滅するのに気付けない）。
 */
export type CellRow = Pick<StudentAnswerDatasetExamStudent, "id" | "studentId">
export type CellColumn = ExamPage

/**
 * (受験者, ページ) → 値 を O(1) で引く入れ子マップ。
 * 文字列合成キー（`${a}:${b}`）も序数も使わず、examStudentId → examPageId → 値 で持つ。
 * グリッド全体分に膨らみうる派生（既存答案・動的無効・配置解決）向け。
 */
export type CellValueMap<T> = Map<string, Map<string, T>>

export function setCellValue<T>(
  cellValues: CellValueMap<T>,
  examStudent: CellRow,
  examPage: CellColumn,
  value: T
): void {
  const pages = cellValues.get(examStudent.id)
  if (pages) {
    pages.set(examPage.id, value)
  } else {
    cellValues.set(examStudent.id, new Map([[examPage.id, value]]))
  }
}

export function getCellValue<T>(
  cellValues: CellValueMap<T>,
  examStudent: CellRow,
  examPage: CellColumn
): T | undefined {
  return cellValues.get(examStudent.id)?.get(examPage.id)
}

/** 値を持たず所属だけを表すセル集合（CellValueMap の存在判定専用の姿）。 */
export type CellLookup = CellValueMap<true>

export function addCellToLookup(
  lookup: CellLookup,
  examStudent: CellRow,
  examPage: CellColumn
): void {
  setCellValue(lookup, examStudent, examPage, true)
}

export function lookupHasCell(
  lookup: CellLookup,
  examStudent: CellRow,
  examPage: CellColumn
): boolean {
  return getCellValue(lookup, examStudent, examPage) ?? false
}

/**
 * 手動無効化（行・列・個別セル）の理由を返す唯一の場所。無効でなければ undefined。
 * 「無効か」の真偽と「なぜ無効か」を1回の評価で確定する（判定の二重走査を避ける）。
 * 既存答案(existing_answer)・確認モードの動的無効はここでは扱わない（呼び出し側の責務）。
 */
export function manualDisabledReason(
  disabledState: ExtendedDisabledState,
  examStudent: StudentAnswerDatasetExamStudent,
  examPage: CellColumn
): DisabledReason {
  if (disabledState.rows.includes(examStudent.id)) {
    return examStudent.status === "absent" ? "absent_student" : "row"
  }
  if (disabledState.cols.includes(examPage.id)) return "column"
  if (hasCell(disabledState.cells, examStudent, examPage)) {
    return "position"
  }
  return undefined
}

/** 生徒をcustomOrder昇順にソートした新しい配列を返す */
export function sortStudentsByCustomOrder(
  students: StudentAnswerDatasetExamStudent[]
): StudentAnswerDatasetExamStudent[] {
  return [...students].sort((studentA, studentB) => {
    const studentAOrder = studentA.customOrder ?? Number.MAX_SAFE_INTEGER
    const studentBOrder = studentB.customOrder ?? Number.MAX_SAFE_INTEGER
    return studentAOrder - studentBOrder
  })
}

/** 確認モードで答案が存在しないセル（無効化対象）を O(1) 照合ルックアップで返す */
export function calculateDynamicDisabledCells<T extends AnswerImageIdentity>(
  files: T[],
  sortedStudents: StudentAnswerDatasetExamStudent[],
  examPages: ExamPage[],
  disabledState: ExtendedDisabledState,
  mode?: "upload" | "view"
): CellLookup {
  const dynamicDisabled: CellLookup = new Map()

  // 確認モードでは答案がないセルのみ無効化
  if (mode === "view") {
    for (const examStudent of sortedStudents) {
      for (const examPage of examPages) {
        // 手動無効化済みのセルはスキップ
        if (manualDisabledReason(disabledState, examStudent, examPage)) {
          continue
        }

        // そのセルに対応する答案があるかチェック
        const hasAnswerForCell = files.some(
          (file) =>
            file.examStudentId === examStudent.id &&
            file.examPageId === examPage.id &&
            !disabledState.files.has(file.id)
        )

        // 答案がない場合は動的無効化
        if (!hasAnswerForCell) {
          addCellToLookup(dynamicDisabled, examStudent, examPage)
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
  sortedStudents: StudentAnswerDatasetExamStudent[],
  examPages: ExamPage[],
  disabledState: ExtendedDisabledState,
  mode?: "upload" | "view",
  existingAnswers?: AnswerImageIdentity[]
): CellLookup {
  const cells: CellLookup = new Map()

  for (const examStudent of sortedStudents) {
    for (const examPage of examPages) {
      // そのセルに対応する答案があるかチェック
      const hasAnswerForCell =
        mode === "upload" && existingAnswers
          ? // アップロードモード: existingAnswers（DB答案の占有信号）から判定
            existingAnswers.some(
              (answer) =>
                answer.examStudentId === examStudent.id &&
                answer.examPageId === examPage.id
            )
          : // 確認モード: files から判定
            files.some(
              (file) =>
                file.examStudentId === examStudent.id &&
                file.examPageId === examPage.id &&
                !disabledState.files.has(file.id)
            )

      if (hasAnswerForCell) {
        addCellToLookup(cells, examStudent, examPage)
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
 * マスに置ける条件は (1) 答案の受験者が現在のロスター（sortedStudents）に居る かつ
 * (2) 答案のページが現在の列（examPages）に含まれる、の両方。どちらかを満たさない答案は
 * 試験から外された・ページ削除などで座標配置できず、表からは不可視になる（＝孤立答案）。
 * 呼び出し側で専用枠に描画して再配置できるようにする。
 *
 * ロスターと列は **実体の配列**で受け取る（呼び出し側が id を選ばない）。
 * placedByCell は (受験者, ページ) で引く CellValueMap（序数キーは使わない）。
 * 同一セルに複数の配置可能答案が解決された場合は先着のみを配置し、後続は孤立扱いに
 * する（黙って上書きして消さない＝表からも孤立枠からも見えなくなる事故を防ぐ。
 * データは @@unique([examPageId, examStudentId]) によりセル衝突は構造的に起きないが、
 * 「解決不能な画像を黙って落とさない」原則をここで担保する）。
 */
export function partitionAnswerItemsByPlacement<T extends AnswerImageIdentity>(
  items: T[],
  sortedStudents: CellRow[],
  examPages: CellColumn[]
): { placedByCell: CellValueMap<T>; orphans: T[] } {
  const rosterByExamStudentId = new Map(
    sortedStudents.map((examStudent) => [examStudent.id, examStudent])
  )
  const columnByExamPageId = new Map(
    examPages.map((examPage) => [examPage.id, examPage])
  )

  const placedByCell: CellValueMap<T> = new Map()
  const orphans: T[] = []

  for (const answerItem of items) {
    const { examStudentId, examPageId } = answerItem
    // 答案が持つ id をロスター・列の実体へ解決する。解決できない＝置き場が無い
    const examStudent =
      examStudentId !== null
        ? rosterByExamStudentId.get(examStudentId)
        : undefined
    const examPage =
      examPageId !== null ? columnByExamPageId.get(examPageId) : undefined

    // 配置可能でも同一セルが既に埋まっていれば孤立へ退避する（上書きで消さない）
    if (
      examStudent &&
      examPage &&
      getCellValue(placedByCell, examStudent, examPage) === undefined
    ) {
      setCellValue(placedByCell, examStudent, examPage, answerItem)
    } else {
      orphans.push(answerItem)
    }
  }

  return { placedByCell, orphans }
}
