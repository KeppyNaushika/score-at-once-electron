import type { ScoringStatus } from "@/types/scoringStatus.types"

// 採点状態のラベル（設定UIの表示用）
export const statusLabels: Record<ScoringStatus, string> = {
  unscored: "未採点",
  correct: "正答",
  incorrect: "誤答",
  partial: "部分点",
  pending: "処理中",
  no_answer: "無答",
  double_mark: "Wマーク",
}
