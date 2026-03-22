import type { ScoringStatus } from "@/components/exams/08-export/components/scoring-mark-settings/types/scoringMarkTypes"

/** 採点状態と透過設定から対応するマーク画像のパスを返す */
export function getMarkImagePath(
  status: ScoringStatus,
  useTransparent: boolean
): string {
  const prefix = useTransparent ? "tranceparent_" : ""
  switch (status) {
    case "unscored":
      return `/score-assets/${prefix}unscored.png`
    case "correct":
      return `/score-assets/${prefix}correct.png`
    case "incorrect":
      return `/score-assets/${prefix}incorrect.png`
    case "partial":
      return `/score-assets/${prefix}partial.png`
    case "pending":
      return `/score-assets/${prefix}partial.png` // 処理中は部分点マークを使用
    case "no_answer":
      return `/score-assets/${prefix}incorrect.png` // 無答も誤答マークを使用
    default:
      return `/score-assets/${prefix}unscored.png`
  }
}
