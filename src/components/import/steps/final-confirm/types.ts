/**
 * 最終確認ステップの共有型
 */

/** 統一サマリー型 */
export interface CategorySummary {
  unchanged: number
  updated: number
  newCount: number
  skipped: number
  idChangeToImport: number
}
