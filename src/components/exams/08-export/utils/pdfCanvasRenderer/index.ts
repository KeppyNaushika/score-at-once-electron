/**
 * PDF出力用Canvas描画ユーティリティ
 *
 * 一括採点個別表示のCanvas描画エンジン（useImageCanvas.ts）を流用し、
 * PDF出力に適した形式でCanvas上に描画を行う。
 */

export {
  preloadScoringMarkImages,
  renderAnswerSheetToCanvas,
} from "./renderAnswerSheet"
export type {
  ScoringDataForPdf,
  SubtotalDataForPdf,
  TotalScoreDataForPdf,
} from "./types"
