/**
 * 答案の解答欄の占有グリッド（main / renderer 共通）
 *
 * main（`electron-src/lib/aiGrading/answerImage.ts`）が答案画像から作り、
 * renderer（`annotationPlacement.ts`）が注釈を手書きに重ねない位置を探すのに使う。
 * IPC を通るので、型付き配列は使わず素の配列で持つ。
 */

/** 解答欄の内側を約1mm角のセルに区切り、セルごとにインクの有無を持つ */
export interface AnswerInkGrid {
  /** グリッド左上の x（用紙比 0〜1）。解答欄の内側の左端 */
  originX: number
  /** グリッド左上の y（用紙比 0〜1）。解答欄の内側の上端 */
  originY: number
  /** セル1つの幅（用紙比） */
  cellWidth: number
  /** セル1つの高さ（用紙比） */
  cellHeight: number
  columnCount: number
  rowCount: number
  /** 行優先（`row * columnCount + column`）。true はインクのあるセル */
  occupiedCells: boolean[]
}
