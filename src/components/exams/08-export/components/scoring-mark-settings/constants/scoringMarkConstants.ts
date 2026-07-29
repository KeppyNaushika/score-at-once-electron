import type {
  MarkPosition,
  ScoreTextConfig,
  ScoringMarkConfig,
} from "@/components/exams/08-export/components/scoring-mark-settings/types"
import type { ScoringStatus } from "@/types/scoringStatus.types"

// 既定色（点数印字・採点記号マーク）
const DEFAULT_PARTIAL_SCORE_COLOR = "#ef4444" // 部分点・配点（赤）
const DEFAULT_SUMMARY_SCORE_COLOR = "#2563eb" // 小計（青）
const DEFAULT_TOTAL_SCORE_COLOR = "#16a34a" // 合計（緑）
export const DEFAULT_MARK_COLOR = "#ef4444" // 採点記号マーク（赤）

// カラーパレット（一括採点アノテーションと同じ基本色）+ 任意のRGBを追加で選択可能
export const SCORE_COLOR_PRESETS = [
  "#000000", // 黒
  "#ef4444", // 赤
  "#ff8000", // オレンジ
  "#ffd700", // 金
  "#16a34a", // 緑
  "#00bcd4", // シアン
  "#2563eb", // 青
  "#8000ff", // 紫
] as const

// 部分点用デフォルト設定
export const defaultPartialScoreConfig: ScoreTextConfig = {
  position: "middle-center",
  offsetX: 0,
  offsetY: 0,
  size: 14,
  alignment: "center",
  color: DEFAULT_PARTIAL_SCORE_COLOR,
  opacity: 100,
}

// 小計・合計点用デフォルト設定（後方互換性のため維持）
const defaultSummaryScoreConfig: ScoreTextConfig = {
  position: "middle-center",
  offsetX: 0,
  offsetY: 0,
  size: 18, // 小計・合計点はやや大きめ
  alignment: "center",
  color: DEFAULT_SUMMARY_SCORE_COLOR,
  opacity: 100,
}

// 小計点用デフォルト設定
export const defaultSubtotalScoreConfig: ScoreTextConfig = {
  position: "middle-center",
  offsetX: 0,
  offsetY: 0,
  size: 18,
  alignment: "center",
  color: DEFAULT_SUMMARY_SCORE_COLOR,
  opacity: 100,
}

// 合計点用デフォルト設定
export const defaultTotalScoreConfig: ScoreTextConfig = {
  position: "middle-center",
  offsetX: 0,
  offsetY: 0,
  size: 18,
  alignment: "center",
  color: DEFAULT_TOTAL_SCORE_COLOR,
  opacity: 100,
}

// デフォルト設定
export const defaultScoringMarkConfig: ScoringMarkConfig = {
  showMarkForStatus: {
    unscored: false,
    correct: true,
    incorrect: true,
    partial: true,
    pending: true,
    no_answer: true,
    double_mark: true,
  },
  showScoreForStatus: {
    unscored: false,
    correct: true,
    incorrect: true,
    partial: true,
    pending: true,
    no_answer: true,
    double_mark: true,
  },
  // 採点マーク設定
  markPosition: "middle-center",
  markOffsetX: 0,
  markOffsetY: 0,
  markSize: 50,
  markColor: DEFAULT_MARK_COLOR,
  markOpacity: 100,
  // 点数テキスト設定（後方互換性のために維持）
  scorePosition: "middle-center",
  scoreOffsetX: 0,
  scoreOffsetY: 0,
  scoreSize: 14,
  scoreAlignment: "center",
  // 部分点設定
  partialScore: { ...defaultPartialScoreConfig },
  // 小計・合計点設定（後方互換性のため維持）
  summaryScore: { ...defaultSummaryScoreConfig },
  // 小計点設定
  subtotalScore: { ...defaultSubtotalScoreConfig },
  // 合計点設定
  totalScore: { ...defaultTotalScoreConfig },
  // PDF設定
  pageSize: "A4",
  pageOrientation: "portrait",
  marginPercent: 5, // 5%の余白
}

// 位置のラベル
export const positionLabels: Record<MarkPosition, string> = {
  "top-left": "左上",
  "top-center": "上",
  "top-right": "右上",
  "middle-left": "左",
  "middle-center": "中央",
  "middle-right": "右",
  "bottom-left": "左下",
  "bottom-center": "下",
  "bottom-right": "右下",
}

// 採点状態のラベル
export const statusLabels: Record<ScoringStatus, string> = {
  unscored: "未採点",
  correct: "正答",
  incorrect: "誤答",
  partial: "部分点",
  pending: "処理中",
  no_answer: "無答",
  double_mark: "Wマーク",
}
