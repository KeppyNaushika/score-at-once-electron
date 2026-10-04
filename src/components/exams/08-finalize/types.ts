import type { ScoreDecisionReason } from "@/types/scoreDecision.types"

/** 一覧に出す裁定理由の絞り込み（07 の採点状態の絞り込みにあたる） */
export type DecisionFilterSettings = Record<ScoreDecisionReason, boolean>
