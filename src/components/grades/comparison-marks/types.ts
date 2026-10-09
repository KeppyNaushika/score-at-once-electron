import type { GradeLabelDirection } from "../gradeLabelValues"

/** 比較の向き。比較先の評定から見た今回の評定の上下か、どちらかに評定が無い（"missing"） */
export type ComparisonDirection = GradeLabelDirection | "missing"

/**
 * 結果のマス1つに並ぶ比較の記号1つ分。
 *
 * `direction` は比較先の評定から見た今回の評定の向き。どちらかに評定が無い
 * （比較先にその生徒が居ない・除外・評定なし、比較先をまだ読み込み中）ときは
 * "missing" で、位置を詰めずに薄い「・」を置く。
 */
export interface ComparisonMark {
  comparisonId: string
  direction: ComparisonDirection
  /** 比較先の成績算出名。この成績算出の別の項目なら null */
  comparedGradeName: string | null
  comparedGradeItemName: string
  comparedPercentage: number | null
  comparedGradeLabel: string | null
}

/** 対象者 id → 評価項目 id → そのマスに並ぶ記号（登録順） */
export type ComparisonMarksByCell = Map<string, Map<string, ComparisonMark[]>>
