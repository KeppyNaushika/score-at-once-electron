/**
 * PDF出力用Canvas描画の共有型
 */

/**
 * 採点データ（PDF出力用）
 */
export interface ScoringDataForPdf {
  questionScoreId: string
  status: string // "unscored" | "correct" | "partial" | "pending" | "incorrect" | "no_answer"
  partialScore?: number | null
  cropRegion: {
    id: string
    x: number
    y: number
    width: number
    height: number
    label: string
    maxScore?: number | null // 配点
    examPage?: {
      pageNumber: number
    }
  }
}

/**
 * 小計点データ（PDF出力用）
 */
export interface SubtotalDataForPdf {
  regionId: string
  label: string
  score: number
  x: number
  y: number
  width: number
  height: number
  pageNumber: number
}

/**
 * 合計点データ（PDF出力用）
 */
export interface TotalScoreDataForPdf {
  regionId: string
  score: number
  maxScore: number
  x: number
  y: number
  width: number
  height: number
  pageNumber: number
}
