import type { ScaleCellAppearance } from "@/components/exams/07-score-at-once/ScaleLevel/utils/scaleLevelAppearance"
import type { ScoreDecisionReason } from "@/types/scoreDecision.types"
import type { ScoringStatus } from "@/types/scoringStatus.types"

import type { DecisionGridItem } from "./hooks/useFinalizeData"

/** 一覧に出す裁定理由の絞り込み（07 の採点状態の絞り込みにあたる） */
export type DecisionFilterSettings = Record<ScoreDecisionReason, boolean>

/**
 * 判定と類型から、類型の見せ方（記号と並び順の色）を引く。
 * 採点状態の見せ方のままでよければ null（`useFinalizeScaleQuestion` が今の設問について作る）
 */
export type ScaleAppearanceOfVerdict = (
  status: ScoringStatus,
  scaleLevelId: string | null
) => ScaleCellAppearance | null

/** 確定できる判定（未採点は確定の対象にならない） */
export type DecisionVerdict = Exclude<ScoringStatus, "unscored">

/** 答案1つへ書く確定（判定はまとめて渡す） */
export interface DecisionWrite {
  item: DecisionGridItem
  decidedScore: number | null
  scaleLevelId: string | null
}
