import type {
  MarkPosition,
  ScoringMarkConfig,
  ScoringStatus,
} from "@/components/projects/08-export/components/scoring-mark-settings/types/scoring-mark-types"

// デフォルト設定
export const defaultConfig: ScoringMarkConfig = {
  showMarkForStatus: {
    unscored: false,
    correct: true,
    partial: true,
    hold: true,
    incorrect: true,
    no_answer: true,
  },
  showScoreForStatus: {
    unscored: false,
    correct: true,
    partial: true,
    hold: true,
    incorrect: true,
    no_answer: true,
  },
  // 採点マーク設定
  markPosition: "middle-center",
  markOffsetX: 0,
  markOffsetY: 0,
  markSize: 50,
  // 点数テキスト設定
  scorePosition: "middle-center", // デフォルトを中央に変更
  scoreOffsetX: 0,
  scoreOffsetY: 0,
  scoreSize: 14,
  scoreAlignment: "center",
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
  partial: "部分点",
  hold: "保留",
  incorrect: "誤答",
  no_answer: "無答",
}
