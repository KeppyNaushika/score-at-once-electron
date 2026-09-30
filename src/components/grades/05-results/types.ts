import type { GRADE_COMPARISON_DISPLAYS } from "@/lib/userPreferences"

import type { GradeLabelDirection } from "../gradeLabelValues"

/**
 * 結果のマス1つに並ぶ比較の記号1つ分。
 *
 * `direction` は比較先の評定から見た今回の評定の向き。どちらかに評定が無い
 * （比較先にその生徒が居ない・除外・評定なし、比較先をまだ読み込み中）ときは
 * "missing" で、位置を詰めずに薄い「・」を置く。
 */
export interface ComparisonMark {
  comparisonId: string
  direction: GradeLabelDirection | "missing"
  /** 比較先の成績算出名。この成績算出の別の項目なら null */
  comparedGradeName: string | null
  comparedGradeItemName: string
  comparedPercentage: number | null
  comparedGradeLabel: string | null
}

/** 対象者 id → 評価項目 id → そのマスに並ぶ記号（登録順） */
export type ComparisonMarksByCell = Map<string, Map<string, ComparisonMark[]>>

/**
 * 変化の記号の出し方。値の一覧は利用者の設定（`GRADE_COMPARISON_DISPLAYS`）が持つ。
 * → と ・ はどの出し方でも薄いまま（動いたものだけを目立たせる）
 */
export type ComparisonDisplay = (typeof GRADE_COMPARISON_DISPLAYS)[number]
