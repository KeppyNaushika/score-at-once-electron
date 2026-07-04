import type { ScoringStatus } from "@/types/scoringStatus.types"

/** 採点状態から対応するマーク画像のパスを返す */
export function getMarkImagePath(status: ScoringStatus): string {
  switch (status) {
    case "unscored":
      return `/score-assets/unscored.png`
    case "correct":
      return `/score-assets/correct.png`
    case "incorrect":
      return `/score-assets/incorrect.png`
    case "partial":
      return `/score-assets/partial.png`
    case "pending":
      return `/score-assets/partial.png` // 処理中は部分点マークを使用
    case "no_answer":
      return `/score-assets/incorrect.png` // 無答も誤答マークを使用
    case "double_mark":
      return `/score-assets/incorrect.png` // Wマークも誤答マークを使用
    default:
      return `/score-assets/unscored.png`
  }
}
