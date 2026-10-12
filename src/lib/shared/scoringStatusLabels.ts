import type { ScoringStatus } from "@/types/scoringStatus.types"

/**
 * 採点状態の呼び名。画面・監査ログ・出力の全部がここを引く（写しを持たない —
 * 写しが「処理中」「正解」「複数マーク」などへずれていた。#1492）
 */
export const SCORING_STATUS_LABELS: Record<ScoringStatus, string> = {
  unscored: "未採点",
  correct: "正答",
  partial: "部分点",
  pending: "保留",
  incorrect: "誤答",
  no_answer: "無答",
  double_mark: "Wマーク",
  evaluated: "類型採点済み",
}
