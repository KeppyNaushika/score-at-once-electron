export type GradeExportTabType = "excel" | "individual-report"

export interface GradeReportOptions {
  /** レポートタイトル */
  title: string
  /** 項目別評価を表示 */
  showItemGrades: boolean
  /** 項目別評価の列選択 */
  itemGradeColumns: {
    score: boolean
    percentage: boolean
    gradeLabel: boolean
  }
  /** データソース内訳を表示 */
  showSourceBreakdown: boolean
  /** データソース内訳の列選択 */
  sourceBreakdownColumns: {
    score: boolean
    weight: boolean
  }
  /** コメント欄を表示 */
  showCommentSection: boolean
  /** 押印欄を表示 */
  showSignatureSection: boolean
  /** 「データソース」の表示ラベル（既定: 成績資料） */
  dataSourceLabel: string
  /** 項目別評価テーブルのフォントサイズ(px) */
  itemGradeFontSize: number
  /** 項目別評価テーブルの列数 */
  itemGradeTableColumns: number
  /** 内訳テーブルのフォントサイズ(px) */
  sourceBreakdownFontSize: number
  /** 内訳テーブルの列数 */
  sourceBreakdownTableColumns: number
  /** フッター */
  footer: {
    left: string
    center: string
    right: string
  }
}

export const DEFAULT_GRADE_REPORT_OPTIONS: GradeReportOptions = {
  title: "個人成績通知書",
  showItemGrades: true,
  itemGradeColumns: {
    score: true,
    percentage: true,
    gradeLabel: true,
  },
  showSourceBreakdown: false,
  sourceBreakdownColumns: {
    score: true,
    weight: true,
  },
  showCommentSection: false,
  showSignatureSection: false,
  dataSourceLabel: "",
  itemGradeFontSize: 11,
  itemGradeTableColumns: 1,
  sourceBreakdownFontSize: 11,
  sourceBreakdownTableColumns: 1,
  footer: { left: "", center: "", right: "" },
}
