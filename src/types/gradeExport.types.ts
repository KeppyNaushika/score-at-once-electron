/**
 * 成績算出の出力（Excel「成績一覧」・個人成績通知書）に比較を載せるための型と既定。
 *
 * 比較の値（比較先の評定・変化の記号）は renderer が算出し（`buildComparisonMarks`）、
 * Excel の書き出しへ IPC で渡す。main は渡された値を書くだけ。
 */

/**
 * 出力で使う比較の選択（`GradeExportComparison`）の行が無い比較を出すか。
 *
 * **出す。** 04 で比較を足せば、何もしなくても出力に載る。外したときだけ
 * `enabled = false` の行ができる。個人成績通知書に記号を出すかは別の列
 * （`itemGradeComparisonMarks`、既定は出さない）が決めるので、比較を足しても通知書の
 * 見た目は変わらない。
 */
export const DEFAULT_EXPORT_COMPARISON_ENABLED = true

/** Excel「成績一覧」の比較の列の、生徒1人分の値 */
export interface GradeExcelComparisonCell {
  /** 対象者（成績算出ごとの行）。算出結果の `gradeStudentId` と突き合わせる */
  gradeStudentId: string
  /** 比較先の評定。取れなければ null（空のマス） */
  comparedGradeLabel: string | null
  /** 変化の記号（↑ ↓ → * ・。結果画面と同じ） */
  symbol: string
}

/**
 * Excel「成績一覧」に足す、比較1件分の列（「{比較先} 成績」と「変化」の2列）。
 *
 * 自分側の評価項目の「(%)」「成績」の右に、配列の順（その項目の比較の `order` の順）で並ぶ。
 */
export interface GradeExcelComparisonColumn {
  comparisonId: string
  /** 自分側の評価項目 */
  gradeItemId: string
  /** 比較先の表示名（同じ成績算出なら項目名、別なら「成績算出名 > 項目名」） */
  comparedTargetName: string
  cells: GradeExcelComparisonCell[]
}
