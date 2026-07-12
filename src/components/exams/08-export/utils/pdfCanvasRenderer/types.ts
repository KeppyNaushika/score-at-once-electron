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
 * 採点マーク設定
 */
export interface ScoringMarkConfigForPdf {
  markPosition: string
  markSize: number
  // 採点記号マークの色・不透明度（markColor未指定時は元画像の色を使用）
  markColor?: string
  markOpacity?: number // 0 to 100
  showPartialScore: boolean
  partialScorePosition: string
  partialScoreSize: number
  partialScoreOffsetX: number
  partialScoreOffsetY: number
  partialScoreColor: string
  partialScoreOpacity: number // 0 to 100
  // 小計点用設定
  subtotalScorePosition: string
  subtotalScoreSize: number
  subtotalScoreOffsetX: number
  subtotalScoreOffsetY: number
  subtotalScoreColor: string
  subtotalScoreOpacity: number // 0 to 100
  // 合計点用設定
  totalScorePosition: string
  totalScoreSize: number
  totalScoreOffsetX: number
  totalScoreOffsetY: number
  totalScoreColor: string
  totalScoreOpacity: number // 0 to 100
  // ステータスごとの表示設定
  showMarkForStatus?: Record<string, boolean>
  showScoreForStatus?: Record<string, boolean>
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
