import type { GRADE_COMPARISON_DISPLAYS } from "@/lib/userPreferences"

/**
 * 変化の記号の出し方。値の一覧は利用者の設定（`GRADE_COMPARISON_DISPLAYS`）が持つ。
 * → と ・ はどの出し方でも薄いまま（動いたものだけを目立たせる）
 */
export type ComparisonDisplay = (typeof GRADE_COMPARISON_DISPLAYS)[number]
