/**
 * 統合アーカイブ（.sao）の画面で、一意キーの列名を日本語で見せるためのラベル
 *
 * main は列名をそのまま返す（文言は renderer が作る）。書き出しダイアログと取り込み
 * ウィザードの両方がここを引く。載っていない名前はそのまま出す。表名の呼び名は
 * `src/lib/shared/tableLabels.ts`（同期の通知と共通）にある。
 */

import { TABLE_LABELS } from "@/lib/shared/tableLabels"

/**
 * 一意キーに出てくる列の日本語ラベル。`…Id` の列は参照先の表のラベルを使う
 * （`examStudentId` → 受験生徒）
 */
const ARCHIVE_COLUMN_LABELS: Readonly<Record<string, string>> = {
  name: "名前",
  key: "キー",
  label: "成績評価記号",
  action: "操作",
  status: "状態",
  clickCount: "クリック回数",
  sectionId: "セクション",
  overlayKind: "重ね表示の種類",
  tableKind: "表の種類",
  statisticKind: "統計の種類",
  scope: "範囲",
  choiceIndex: "選択肢の番号",
  assignmentType: "割り当ての種類",
  username: "ユーザー名",
  studentNumber: "学籍番号",
  lastName: "姓",
  firstName: "名",
}

/** 列名の先頭を大文字にして表名の形にする（`examStudent` → `ExamStudent`） */
const toTableName = (columnStem: string): string =>
  columnStem.charAt(0).toUpperCase() + columnStem.slice(1)

/** 参照先の表名が列名から素直に引けない `…Id` 列 */
const REFERENCE_COLUMN_TABLES: Readonly<Record<string, string>> = {
  omrConfigId: "CropRegionOmrConfig",
  constraintId: "GradeConstraint",
  dataSourceId: "GradeDataSource",
  sourceDataSourceId: "GradeDataSource",
  comparedGradeItemId: "GradeItem",
  subQuestionId: "AsbSubQuestion",
  branchQuestionId: "AsbBranchQuestion",
}

/** 列名の日本語ラベル。載っていなければ列名のまま */
export function archiveColumnLabel(column: string): string {
  const columnLabel = ARCHIVE_COLUMN_LABELS[column]
  if (columnLabel) return columnLabel
  if (column.endsWith("Id")) {
    const referencedTable =
      REFERENCE_COLUMN_TABLES[column] ?? toTableName(column.slice(0, -2))
    const referencedTableLabel = TABLE_LABELS[referencedTable]
    if (referencedTableLabel) return referencedTableLabel
  }
  return column
}
