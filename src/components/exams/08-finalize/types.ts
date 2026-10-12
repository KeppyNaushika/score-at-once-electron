import type { ScaleCellAppearance } from "@/components/exams/07-score-at-once/ScaleLevel/utils/scaleLevelAppearance"
import type { ScoreDecisionReason } from "@/types/scoreDecision.types"
import type { ScoringStatus } from "@/types/scoringStatus.types"

/** 一覧に出す裁定理由の絞り込み（07 の採点状態の絞り込みにあたる） */
export type DecisionFilterSettings = Record<ScoreDecisionReason, boolean>

/**
 * 判定と類型から、類型の見せ方（記号と並び順の色・方式と合わない採点の印）を引く。
 * 採点状態の見せ方のままでよければ null（`useFinalizeScaleQuestion` が今の設問について作る）
 */
export type ScaleAppearanceOfVerdict = (
  status: ScoringStatus,
  scaleLevelId: string | null
) => ScaleCellAppearance | null
