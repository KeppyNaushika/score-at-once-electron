import type {
  MarkPosition,
  ScoreTextConfig,
  ScoringMarkConfig,
  ScoringStatus,
} from "@/components/projects/08-export/components/scoring-mark-settings/types/scoring-mark-types"

// 部分点用デフォルト設定
export const defaultPartialScoreConfig: ScoreTextConfig = {
  position: "middle-center",
  offsetX: 0,
  offsetY: 0,
  size: 14,
  alignment: "center",
}

// 小計・合計点用デフォルト設定
export const defaultSummaryScoreConfig: ScoreTextConfig = {
  position: "middle-center",
  offsetX: 0,
  offsetY: 0,
  size: 18, // 小計・合計点はやや大きめ
  alignment: "center",
}

// デフォルト設定
export const defaultConfig: ScoringMarkConfig = {
  showMarkForStatus: {
    unscored: false,
    correct: true,
    incorrect: true,
    partial: true,
    pending: true,
    no_answer: true,
  },
  showScoreForStatus: {
    unscored: false,
    correct: true,
    incorrect: true,
    partial: true,
    pending: true,
    no_answer: true,
  },
  // 採点マーク設定
  markPosition: "middle-center",
  markOffsetX: 0,
  markOffsetY: 0,
  markSize: 50,
  // 点数テキスト設定（後方互換性のために維持）
  scorePosition: "middle-center",
  scoreOffsetX: 0,
  scoreOffsetY: 0,
  scoreSize: 14,
  scoreAlignment: "center",
  // 部分点と小計・合計点を別々に設定するかどうか
  useSeparateScoreSettings: false,
  // 部分点設定
  partialScore: { ...defaultPartialScoreConfig },
  // 小計・合計点設定
  summaryScore: { ...defaultSummaryScoreConfig },
  useTransparent: false,
  // PDF設定
  pageSize: "A4",
  pageOrientation: "portrait",
  marginPercent: 5, // 5%の余白
}

// localStorageのキー
export const STORAGE_KEY = "scoring-mark-config"

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
}
